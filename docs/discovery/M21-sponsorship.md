# M21 — Sponsorship & Anak Angkat: admin sponsors, anak angkat assignments, foster-family applications, "Mohon Keluarga Angkat" form, public sponsor registration (Discovery)

- **Source:** live read-only walk-through of https://prestasiplus.my on **2026-09-27** with the admin account (browser lane 1, `playwright`). First pass 05:19–05:40 MYT (guard, crawl, probes); the run was paused by an API rate limit and resumed 10:14–10:40 MYT (the session had expired; the guard was re-verified by probe before the new login). A fresh cookie-less context was used for the guest view.
- **Screenshots:** `docs/discovery/img/M21/` (32 files, §10). Every page was masked in the DOM before capture. The admin shell (`SHA`), the user shell (`SHU`) and design tokens are in [00-global-ui.md](00-global-ui.md) and are not repeated here.
- **Language:** UI copy is quoted in its exact Bahasa Melayu. Some copy on live is English or mixed: "Assign Anak Angkat", "Assign", "Graduate", "Graduated", "Withdrawn", "Expired", "Active", "Pending", "Direct", "Via Agent", "Anak Angkat — Sponsorship", the raw enum "SUSPENDED" / "(SUSPENDED)", the Laravel pager "« Previous" / "Next »" / "Showing 0 of 6 results", "Tiada permohonan approved / matched / rejected", and the unbranded Symfony 405 page.
- **Personal data:** the sponsor contact officer (name, phone), the linked sponsor user e-mails, the adopted student, the three applicant students and the applicant parent are real people. `tools/jobs/M21.js` → `M21MASK` tags every e-mail-shaped leaf, every phone-shaped leaf or token, leaves with BIN / BINTI / BTE / BT / A/L / A/P, every cell of the table columns **Pelajar / Pemohon / Pegawai / Penaja / Sebab** (application reasons are family circumstances written by a parent), and blanks every contact / address / registration input (class `.m21n`, masked and scrubbed globally). `tools/sanitize.js` then runs with `{selectors:['.m21n'], titleName:false, keepSelects:'student_category|family_income_range|channel'}`. `piiLeakCheck` = **0 leaks in all 55 states**; a scripted scan of every M21 file finds none of the observed personal strings (§11). E-mails on these pages are Cloudflare-protected in the raw HTML (`__cf_email__`), so the snapshot records presence flags only.
  - **Organisation names are kept.** Sponsors are companies ("Kedai Buku Popular", "Faber-Castell Malaysia", "KidZania Kuala Lumpur", "Petrosains Discovery Centre", "PRESTASIPLUS Official", "Alesa It Services"); they are not personal names. No real person's name appears in this document.
  - **Over-masking (not personal data):** the S4 "Penaja" column (organisation) shows `<person>`; `sanitize.js` blanks the input named `name` (organisation name on S3) and the S3 header subtitle; on S6 the list item after the label "Ibu bapa" is masked, so the inventory / PNG show `<person>` for "**Guru / Kaunselor** — mohon untuk pelajar yang dikenal pasti memerlukan". Real copy is in this document and the snapshot.
- **Seed snapshot:** `docs/discovery/inventory/M21/_snapshot-2026-09-27.json`, captured **2026-09-27 10:25 MYT (02:24Z)** in one pass by `tools/jobs/M21-snapshot.js` (GET only through the guard cache, ≥ 450 ms apart). It holds the 6 sponsor rows and 11 filter results, the non-personal fields of all 6 sponsors (edit pages), the S4 stat cards / tabs / assignment row and 5 filter results, the S5 tabs / 3 application rows and 4 filter results, the S6 form copy and examples, the S7 required fields, the M17 sponsor cards and the M02 sponsor-user count, the layout measurements (`tools/jobs/M21-measure.js`) and a side-effect ledger (§5.4). **The snapshot is the seed source.**
- **Element inventory:** **345 content elements** over 7 screens and **55 captured UI states**, IDs `EL-M21-S#-nnn`, in `docs/discovery/inventory/M21/<S#-key>.json`, plus the shell files `SHA-admin-shell.json` (217) and `SHU-user-shell.json` (372). Reconciliation, the crawl and the read-only limits are in `docs/discovery/inventory/M21/_summary.md`.
- **Safety:**
  - A context-level guard (`tools/jobs/M21-guard.js`) was installed **before any capture** on every browser context (admin and guest). It aborts every request whose method is not GET / HEAD / OPTIONS except `POST /login`, every payment-gateway host, every download / export navigation, and every write-shaped GET (approve / lulus / reject / tolak / suspend / activate / aktifkan / toggle / delete / assign / taja / bayar / whatsapp / redirect / logout …). Verified by probe (twice, before and after the re-login): `POST` and `DELETE /__m21_probe`, `GET /admin/sponsors/__m21_probe/approve`, `GET /admin/anak-angkat/__m21_probe/toggle`, `GET /__m21_probe/whatsapp` and `GET /logout` were all blocked. The guard also blocked 82+ Cloudflare RUM beacons (`POST /cdn-cgi/rum`), which is harmless.
  - **Detail-page cache:** every document / fetch GET of an M21 path reaches the server **once per context**; later loads (states, widths, screenshots, measurements, snapshot) are served from the guard's in-memory cache. The cache survived the session expiry (same context), so no M21 URL was requested twice (§5.4).
  - Nothing was submitted, saved, reactivated, assigned, graduated, withdrawn, approved, rejected or registered. Never triggered: "Tambah Penaja" (`POST /admin/sponsors`), "Kemaskini Penaja" (`PUT /admin/sponsors/{id}`), "Aktifkan Semula" (`POST /admin/sponsors/{id}/reactivate`), "Assign" (`POST /admin/anak-angkat/assign`), "Graduate" / "Tarik" (`POST /admin/anak-angkat/{id}/status`), "Lulus" / "Tolak" (`POST /admin/anak-angkat/permohonan/{id}/lulus|tolak`), "Hantar Permohonan" on S6 (`POST /mohon-keluarga-angkat`) and on S7 (`POST /sponsor/register`). The student search box on S4 (`GET /admin/anak-angkat/cari-pelajar?q=`, returns student names / e-mails) was never typed into.
  - Client-side reveals only: the S6 example reasons (`onclick` copies the text into the textarea; nothing is sent), the S7 wizard (category tile, "Seterusnya" steps 1 → 2 → 3, password eye). Filters and pagination were driven by URL query strings (GET).
  - One browser, one request at a time, ≥ 350 ms between navigations (450 ms in the crawl and the snapshot).

Cross-references (owned elsewhere, not re-inventoried):
- **M17** hosts the provisional sponsor store today (`owner: 'M21', provisional: true`; Q-M17-SPONSORS): dashboard cards "Jumlah Penaja" 6 / "0 Aktif", "Menunggu Kelulusan" 0, "Ditolak" 0, "Digantung" 6. Re-read on live now: **unchanged and consistent with S1** (§5.3 C1).
- **M02** owns the sponsor **user accounts** (role `sponsor`, label "Penaja"; `/admin/users?role=sponsor` = 6 rows now) and the students / parent referenced by S4 / S5.
- **M01** login / register pages link "Daftar sebagai Penaja" → S7; **M08** student profile CTA "Jadi Penaja" (`fa-heart`) → S7.
- **M15** Kedai Hadiah: sponsor "Hadiah" count (S3) and the sponsor description "Ganjaran rasmi dari PRESTASIPLUS — hadiah eksklusif untuk pelajar cemerlang!" suggest sponsors supply rewards; `/sponsor/rewards` exists (403 for admin). Relationship not observable (§9).
- The global 404 "Halaman Tidak Dijumpai", 403 "Akses Ditolak", 500 "Ralat Pelayan" pages and the Symfony 405 page are global (00-global-ui / M19 §2.2).

---

## 1. Overview

The TRACKER checklist had 5 M21 routes (4 plus `/sponsor/register` from M01). The crawl found **7 screens** (2 new routes: `/admin/sponsors/create`, `/admin/sponsors/{id}/edit`), 11 write endpoints / POST-only routes (never submitted), 1 student-search JSON endpoint (never called) and a **role-gated sponsor portal** (`/sponsor`, `/sponsor/anak-angkat`, `/sponsor/anak-angkat/pool`, `/sponsor/rewards` → 403 for the admin; content not observable).

| # | Route | Tab title (`<title>`) · header h1 / subtitle | Shell | Status on admin account |
|---|---|---|---|---|
| S1 | `/admin/sponsors` (`?search=&status=&category=&page=`) | "Urus Penaja - Admin" · "Pengurusan Penaja" / "Semak dan urus permohonan penaja" | SHA | 200; guest → 302 `/login` |
| S2 | `/admin/sponsors/create` (**new**) | "Tambah Penaja - Admin" · "Tambah Penaja Baru" / "Daftar penaja baru (auto-diluluskan)" | SHA | 200 |
| S3 | `/admin/sponsors/{id}/edit` (**new**) | "Edit Penaja - Admin" · "Edit Penaja" / {organisation name} | SHA | 200; unknown id → 404; row "Lihat" `GET /admin/sponsors/{id}` → **500** |
| S4 | `/admin/anak-angkat` (`?status=`) | "Pengurusan Anak Angkat" · "Anak Angkat — Sponsorship" / "Selamat datang, Admin" | SHA | 200; `GET /admin/anak-angkat/{x}` → **405** |
| S5 | `/admin/anak-angkat/permohonan` (`?status=`) | "Permohonan Anak Angkat" · "Permohonan Keluarga Angkat" / "Selamat datang, Admin" | SHA | 200; `/admin/anak-angkat/permohonan/{id}` → 404 |
| S6 | `/mohon-keluarga-angkat` | "Mohon Keluarga Angkat" · SHU header "Dashboard" / "Selamat datang kembali" (page H1 "Mohon Keluarga Angkat") | SHU | 200; guest → 302 `/login` |
| S7 | `/sponsor/register` | "Daftar Penaja - PRESTASIPLUS" · no shell; H1 "PRESTASIPLUS" / "Pendaftaran Penaja" | none (standalone guest-style page) | 200 for admin **and** guest |

**Access outcomes found by probing (GET):**
- **403** "Akses Ditolak" ("🚫", "Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir.", links "Halaman Utama", "Log Masuk") for the admin on the sponsor portal: `/sponsor`, `/sponsor/anak-angkat`, `/sponsor/anak-angkat/pool`, `/sponsor/rewards`.
- **405** Symfony page ("Oops! An Error Occurred" / "The server returned a "405 Method Not Allowed"." / "Something is broken. Please let us know what you were doing when this error occurred. We will fix it as soon as possible. Sorry for any inconvenience caused."): `/admin/anak-angkat/2`, `/admin/anak-angkat/create`, `/admin/anak-angkat/pool`, `/admin/anak-angkat/sponsors` (all match a POST-only `/admin/anak-angkat/{id}` route) and `/sponsor/profile` (POST-only).
- **500** "Ralat Pelayan" ("⚙️", "Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar lagi.", "Halaman Utama", "Cuba Semula" = `javascript:location.reload()`): `/admin/sponsors/6`, `/admin/sponsors/11` (the list's "Lihat" button, D-M21-01).
- **404** "Halaman Tidak Dijumpai": `/admin/sponsors/999999`, `/admin/sponsors/999999/edit`, `/admin/sponsor`, `/admin/penaja`, `/admin/sponsors/applications`, `/admin/anak-angkat/permohonan/1`; `/sponsor/dashboard`, `/sponsor/login`, `/sponsor/pool`, `/sponsor/pelajar`, `/sponsor/hadiah`, `/sponsor/laporan`, `/sponsor/reports`, `/sponsor/students`, `/sponsor/status`, `/sponsor/pending`, `/sponsor/menunggu`, `/sponsor/profil`, `/sponsor/tetapan`, `/sponsor/settings`, `/sponsor/register/success`, `/sponsor/berjaya`, `/sponsor/home`, `/sponsor/index`, `/sponsor/campaigns`, `/sponsor/kempen`, `/sponsor/sumbangan`, `/sponsor/invoices`, `/sponsor/1`; `/penaja`, `/penaja/dashboard`, `/anak-angkat`, `/keluarga-angkat`, `/keluarga-angkat/dashboard`, `/mohon-keluarga-angkat/status`.
- **Guest** (fresh context): S1, S2, S4, S5, S6 and the sponsor portal all 302 → `/login`; S7 is public.

**Entry points:**
- SHA sidebar group **"Pengguna"** (`toggle('pengguna')`, together with M02's Senarai Pengguna, Sekolah, Langganan Sekolah, Import Pelajar, Pelajar Komplimen, Import Pengguna): "Penajaan" (`fa-handshake`) → S1, "Anak Angkat" (`fa-child`) → S4, "Permohonan" (`fa-file-alt`) → S5. The sidebar label is "Penajaan"; the page title is "Urus Penaja" and the h1 "Pengurusan Penaja".
- SHA mobile bottom nav (below `lg`): "Penaja" (`fa-handshake`) → S1.
- SHU user menu group **"💎 KILLER FEATURES"** (after "Pembetulan", before "Penguasaan"): "Mohon Keluarga Angkat" (`fa-hand-holding-heart`, pink) → S6. The roles-matrix student menu screenshot shows the same item for a student account.
- Public: M01 "Mewakili organisasi? Daftar sebagai Penaja" and M08 "Jadi Penaja" → S7.
- In-module: S1 "Tambah Penaja" → S2, row "Lihat" → 500, row "Edit" → S3; S2 / S3 "Kembali ke Senarai Penaja" and "Batal" → S1; S6 "sini" → `/register` (M01); S7 "Log Masuk" → `/login`, "Daftar Sebagai Pelajar" → `/register`, "Kembali ke Laman Utama" → `/`.

### 1.1 Shell by screen

| Screen | Shell | Evidence |
|---|---|---|
| S1–S5 | `SHA` admin panel (server-status chips, sidebar, header title per page; server-status chip title "GB /") | header h1 / subtitle as §1 |
| S6 | `SHU` user portal (coin / mata / streak chips, bell, avatar menu, tournament banner "LIVE:" / "MAIN" / "DAFTAR" hidden) | same shell as M05–M20 user pages; header title stays "Dashboard" (D-M21-06) |
| S7 | no shell: gradient page, centred card, footer links | like M01 login / register |
| error states | global 404 / 403 / 500 pages (no shell); Symfony 405 page | S3 `not-found`, `show-500`; S4 `show-405`; S5 `not-found` |

## 2. Screens

### 2.1 S1 — `/admin/sponsors` "Pengurusan Penaja"

1. **5 stat cards** (2 columns at 375, 5 at ≥ 768): "6" "Jumlah", "0" "Menunggu", "0" "Diluluskan", "0" "Ditolak", "6" "Digantung". The cards are **global** (they do not follow the filter).
2. Count line "6 penaja dijumpai" (`{n} penaja dijumpai`: "1 penaja dijumpai", "0 penaja dijumpai") and gradient button link "Tambah Penaja" (`fa-plus-circle`) → S2.
3. **GET filter card:**
   - "Carian" text `search`, placeholder "Nama, email...";
   - "Status" select `status`: "" "Semua Status", `PENDING` "Menunggu", `APPROVED` "Diluluskan", `REJECTED` "Ditolak", `SUSPENDED` "Digantung" (lower-case values in the URL give the same result);
   - "Kategori" select `category`: "" "Semua Kategori" + the 13 categories (Appendix A);
   - button "Cari" (`fa-search`); a "Reset" link (`fa-times`) → `/admin/sponsors` appears once any filter is set.
4. **Table** columns "#", "Organisasi", "Kategori", "Pegawai", "Status", "Tarikh", "Tindakan":
   - "#" = sponsor id;
   - "Organisasi" = organisation name (bold) + the linked sponsor user's e-mail (small, masked);
   - "Kategori" = building icon + category label ("Syarikat Swasta");
   - "Pegawai" = contact officer name + phone (masked) or "-";
   - "Status" = badge "Digantung" (`fa-ban`, orange);
   - "Tarikh" = registration date `dd/mm/yyyy`;
   - "Tindakan" = "Lihat" (`fa-eye`) → `/admin/sponsors/{id}` (**500**, D-M21-01) and "Edit" (`fa-edit`) → S3.
5. **Order:** #11 first, then #6 → #10 (INFERRED: `created_at` descending; #11 registered 31/03/2026, #6–#10 on 06/02/2026 with id ascending as the tie-break — Perlu pengesahan).
6. **Empty state** (status Menunggu / Diluluskan / Ditolak, category Individu / Peribadi, a search with no match): one table row "Tiada penaja dijumpai" and "0 penaja dijumpai".
7. **Pagination:** no pager at 6 rows. `?page=2` shows an empty table ("Tiada penaja dijumpai"), the count line still "6 penaja dijumpai", and the Laravel default pager in English: "« Previous", "Next »" (hidden variants), "Showing 0 of 6 results", page link "1" (D-M21-04).

### 2.2 S2 — `/admin/sponsors/create` "Tambah Penaja Baru" (new)

Link "Kembali ke Senarai Penaja" (`fa-arrow-left`) → S1. One card, form `POST /admin/sponsors` (`_token`), three sections:
1. **"Maklumat Organisasi"** (`fa-building`; 2 columns at ≥ 768):
   - "Nama Organisasi *" `name` (text, required, placeholder "cth: Kedai Buku Popular");
   - "Kategori *" `category` (select, required; the 13 categories, no empty option, first = "Individu / Peribadi");
   - "Penerangan" `description` (textarea, placeholder "Penerangan ringkas organisasi...");
   - "Tagline" `tagline` (placeholder "cth: Membaca Jambatan Ilmu");
   - "Website" `website` (type url, placeholder "https://example.com");
   - "URL Logo" `logo_url` (text, placeholder "https://example.com/logo.png");
   - "No. Pendaftaran (SSM/ROC)" `registration_number`.
2. **"Maklumat Pegawai Perhubungan"** (`fa-user-tie`): "Nama Pegawai" `contact_person_name`, "Jawatan" `contact_person_position`, "Email" `contact_email` (type email), "Telefon" `contact_phone` — all optional.
3. **"Alamat"** (`fa-map-marker-alt`): "Alamat" `address`, "Bandar" `city`, "Negeri" `state` (**free text**, while S7 uses a state select), "Poskod" `postcode` (3 columns at ≥ 768).
4. Buttons "Tambah Penaja" (`fa-plus-circle`, gradient; never clicked) and "Batal" → S1.

Only `name` and `category` are required. The subtitle says a sponsor created here is **auto-approved** ("auto-diluluskan"; INFERRED status APPROVED).

### 2.3 S3 — `/admin/sponsors/{id}/edit` "Edit Penaja" (new)

- Link "Kembali ke Senarai Penaja" → S1. Form `POST /admin/sponsors/{id}` `_method=PUT`, the same three sections and fields as S2 (values prefilled; **no placeholders** on any field).
- Summary strip under "Alamat": "SUSPENDED" "Status" (raw enum), "0" "Hadiah", "06/02/2026" "Tarikh Daftar" (#11: "31/03/2026").
- Buttons "Kemaskini Penaja" (`fa-save`, never clicked) and "Batal" → S1.
- **Status card** (separate): toggle icon, "Status Penaja:" red dot "Digantung" "(SUSPENDED)", and for a suspended sponsor a form `POST /admin/sponsors/{id}/reactivate`, `onsubmit="return confirm('Aktifkan semula penaja ini?')"`, button "Aktifkan Semula" (`fa-play-circle`, green; never clicked). The actions for other statuses (approve / reject / suspend) are not observable (all 6 are suspended, §9).
- Observed: #6–#10 have no contact officer, address or registration number; #11 has all contact and address fields filled (masked).
- At 375 the status card overflows the page by 49 px (D-M21-05).
- Unknown id → 404. `GET /admin/sponsors/{id}` → 500.

### 2.4 S4 — `/admin/anak-angkat` "Anak Angkat — Sponsorship"

1. **4 stat cards** (2 / 4 columns): "Jumlah Penaja" 1, "Pelajar Aktif Ditaja" 1, "Graduated" 0, "Withdrawn" 0. Global (do not follow the tab).
2. **"Assign Anak Angkat"** card (`fa-user-plus`), form `POST /admin/anak-angkat/assign`:
   - "Penaja" select `sponsor_id` (required): only "Pilih Penaja" — **no sponsor is listed** (INFERRED: only approved sponsors; all 6 are suspended);
   - "Cari Pelajar (nama/email)" Alpine search box, placeholder "Taip nama atau email...", `@input.debounce.300ms` → `fetch('/admin/anak-angkat/cari-pelajar?q=')` once 2+ characters are typed; results dropdown (`x-for="s in results"`, each item shows the student's name and e-mail; clicking fills hidden `student_email`); after a pick a line shows the chosen name and "(" + e-mail + ")" (`x-show="selectedEmail"`). Never typed into (§9);
   - "Kategori" select `student_category`: "" "-", `B40`, `Asnaf`, `Yatim`, `OKU` (no "Lain-lain", unlike S6);
   - "Saluran" select `channel`: `direct` "Direct", `mlm` "Via Agent";
   - button "Assign" (`fa-plus`).
3. **Status tabs** (links): "Semua (1)" `?status=all` (default), "Aktif (1)" `?status=active`, "Graduated (0)", "Withdrawn (0)", "Expired (0)". The active tab is filled blue. **"Semua" shows the count of the current filter**: on the Graduated / Withdrawn / Expired tabs it reads "Semua (0)" (D-M21-03).
4. **Table** "#", "Penaja", "Pelajar", "Kategori", "Saluran", "Status", "Tarikh", "Aksi":
   - one row: #2; sponsor "Alesa It Services" + raw category "SYARIKAT_SWASTA" (10 px); student name + e-mail (masked); badge "B40" (amber); badge "Direct" (blue); badge "Active" (green); "31/03/2026";
   - actions (active row only): form `POST /admin/anak-angkat/{id}/status` `status=graduated` button "Graduate" (blue) and form `status=withdrawn` button "Tarik" (red). **No confirm on either** (never clicked).
   - empty state: "Tiada rekod".
5. Badges and the "Graduate" / "Tarik" buttons are 10 px text at every width (D-M21-07). At 375 the tab row overflows the page by 37 px (D-M21-05). The table scrolls horizontally inside its card.

### 2.5 S5 — `/admin/anak-angkat/permohonan` "Permohonan Keluarga Angkat"

1. **4 status tabs as cards** (2 / 4 columns): "Menunggu" 3 (`?status=pending`, default), "Dalam Pool" 0 (`?status=approved`), "Ditaja" 0 (`?status=matched`), "Ditolak" 0 (`?status=rejected`). The counts are global.
2. **Table** "#", "Pelajar", "Pemohon", "Kategori", "Sebab", "Status", "Aksi":
   - "Pelajar" = student name (bold) + e-mail + school name or "-" (masked);
   - "Pemohon" = applicant name + role in raw English ("parent" / "student") (masked);
   - "Kategori" = badge ("B40");
   - "Sebab" = reason truncated to 80 characters + "..." (no tooltip / no full-text view, §9);
   - "Status" = badge "Pending" (amber);
   - "Aksi" (pending rows): form `POST /admin/anak-angkat/permohonan/{id}/lulus` button "Lulus" (`fa-check`, blue, **no confirm**) and form `…/tolak` `onsubmit="return confirm('Tolak permohonan ini?')"` button "Tolak" (`fa-times`, red). Never clicked.
3. Rows (id descending): #3, #2, #1 — all "B40", "Pending" (§5.2).
4. **Empty states:** "Tiada permohonan approved", "Tiada permohonan matched", "Tiada permohonan rejected" (raw status value inside BM copy, D-M21-08).
5. Most table text is 10 px (18 elements at every width, D-M21-07). The table scrolls inside its card at 375 / 768.

### 2.6 S6 — `/mohon-keluarga-angkat` "Mohon Keluarga Angkat"

- Gradient hero: H1 "Mohon Keluarga Angkat" / "Isi borang ini untuk memohon tajaan akses PrestasiPlus secara percuma."
- **Form** `POST /mohon-keluarga-angkat` (never submitted):
  - "Email Pelajar" `student_email` (email, required, placeholder "pelajar@email.com"); hint "Email pelajar yang berdaftar dalam PrestasiPlus. Jika pelajar belum daftar, minta mereka daftar terlebih dahulu di sini." with link "sini" → `/register`;
  - "Kategori Pelajar" `student_category` (required): "" "Pilih kategori", `B40` "B40 — Pendapatan rendah", `Asnaf` "Asnaf — Layak bantuan zakat", `Yatim` "Yatim — Tiada ibu/bapa", `OKU` "OKU — Orang kurang upaya", `Lain-lain` "Lain-lain";
  - "Anggaran Pendapatan Keluarga" `family_income_range` (optional): "" "Pilih (pilihan)", `< RM1,000` "Bawah RM1,000", `RM1,000 - RM2,500` "RM1,000 - RM2,500", `RM2,500 - RM4,000` "RM2,500 - RM4,000", `> RM4,000` "Atas RM4,000";
  - "Sebab Permohonan" `reason` (textarea, 4 rows, required, no length limit, placeholder "Terangkan kenapa pelajar ini memerlukan tajaan...");
  - grey box "Contoh sebab permohonan:" (`fa-lightbulb`) with 5 clickable examples (each `onclick` sets the textarea to `this.innerText`, **including the leading "• "**):
    1. "• Keluarga berpendapatan rendah (B40). Bapa bekerja sebagai buruh am, ibu suri rumah. Tidak mampu membayar yuran tuisyen tambahan untuk persediaan SPM."
    2. "• Pelajar yatim piatu yang tinggal bersama nenek. Nenek sudah tua dan tiada pendapatan tetap. Pelajar ini berpotensi tetapi tiada akses kepada bahan pembelajaran digital."
    3. "• Anak asnaf yang menerima bantuan zakat. Keluarga mempunyai 6 orang anak dan pendapatan tidak mencukupi untuk perbelanjaan pendidikan tambahan."
    4. "• Pelajar OKU (masalah penglihatan) yang memerlukan akses digital kerana sukar membaca buku teks biasa. Platform digital lebih mesra OKU dengan saiz teks boleh dilaraskan."
    5. "• Pelajar cemerlang dari keluarga miskin. Mendapat 5A dalam PT3 tetapi ibu bapa tidak mampu hantar ke tuisyen. Dengan PrestasiPlus, pelajar ini boleh belajar sendiri dari rumah."
  - italic 10 px note "Klik mana-mana contoh untuk guna sebagai template. Sila ubahsuai mengikut situasi sebenar.";
  - button "Hantar Permohonan" (`fa-paper-plane`, full width).
- **Info box:** "Apa yang berlaku selepas mohon?" — ordered list "Admin semak dan luluskan permohonan (1-3 hari bekerja)", "Pelajar masuk ke pool — sponsor/keluarga angkat boleh pilih", "Bila sponsor pilih, pelajar dapat akses PERCUMA PrestasiPlus selama 1 sesi persekolahan", "Keluarga angkat boleh pantau prestasi pelajar dari dashboard mereka"; "Siapa boleh mohon?" — "**Pelajar sendiri** — mohon untuk diri sendiri", "**Ibu bapa** — mohon untuk anak", "**Guru / Kaunselor** — mohon untuk pelajar yang dikenal pasti memerlukan".
- The SHU header keeps "Dashboard" / "Selamat datang kembali" on this page (D-M21-06).
- Layout: single centred column (max ~670 px) at every width; no overflow.

### 2.7 S7 — `/sponsor/register` "Pendaftaran Penaja"

- Gradient page; H1 "PRESTASIPLUS" (48 px ≥ 768, 24 px at 375), subtitle "Pendaftaran Penaja"; step pills "Organisasi" (`fa-building`), "Hubungan" (`fa-user`), "Akaun" (`fa-lock`) joined by bars that turn green for completed steps (`:class` active / completed).
- Form `POST /sponsor/register` (Alpine `{ step: 1, loading: false, selectedCategory: '', showPassword: false, showPasswordConfirm: false }`), 3 steps (`x-show="step === n"`):
  1. **"Maklumat Organisasi"**: "Nama Organisasi / Syarikat *" `organization_name` (required, placeholder "Contoh: Syarikat ABC Sdn Bhd"); "Kategori Penaja *" = 13 icon tiles (3 columns ≥ 768, 2 at 375; icons in Appendix A) setting hidden `category`; "No. Pendaftaran (SSM/ROC)" `registration_number` (placeholder "Contoh: 202001012345"); "Penerangan Organisasi" `description` (placeholder "Ringkasan tentang organisasi anda..."); "Laman Web" `website` (url, placeholder "https://contoh.com"); button "Seterusnya" (`fa-arrow-right`) → step 2 if a tile is selected, else `alert('Sila pilih kategori penaja.')`.
  2. **"Maklumat Hubungan & Alamat"**: "Nama Pegawai Perhubungan *" `contact_person_name` ("Nama penuh"); "Jawatan" `contact_person_position` ("Contoh: Pengurus"); "E-mel Perhubungan *" `contact_email` ("email@organisasi.com"); "No. Telefon *" `contact_phone` (tel, "012-3456789"); "Alamat *" `address` (textarea, "No. lot, jalan, taman..."); "Bandar *" `city` ("Kluang"); "Negeri *" `state` select ("" "Pilih negeri", Johor, Kedah, Kelantan, Melaka, Negeri Sembilan, Pahang, Perak, Perlis, Pulau Pinang, Sabah, Sarawak, Selangor, Terengganu, W.P. Kuala Lumpur, W.P. Putrajaya, W.P. Labuan); "Poskod *" `postcode` ("86000"); buttons "Kembali" (`fa-arrow-left`) and "Seterusnya" (no validation on this step).
  3. **"Akaun Log Masuk"**: "Nama Penuh Anda *" `name` ("Nama anda"); "E-mel Log Masuk *" `email` ("anda@email.com"); "Kata Laluan *" `password` ("Minimum 6 aksara") and "Sahkan Kata Laluan *" `password_confirmation` ("Taip semula kata laluan"), each with an eye toggle (`fa-eye` ↔ `fa-eye-slash`); note (`fa-info-circle`) "Dengan mendaftar, anda bersetuju bahawa permohonan ini akan disemak oleh pentadbir PRESTASIPLUS. Anda akan dimaklumkan melalui e-mel apabila status permohonan dikemaskini."; buttons "Kembali" and "Hantar Permohonan" (`fa-paper-plane`; `x-if` swaps to "Menghantar..." `fa-circle-notch` while loading). Never clicked.
- Footer: "Sudah ada akaun? · " "Log Masuk" → `/login`, "Daftar Sebagai Pelajar" → `/register`; "Kembali ke Laman Utama" (`fa-home`) → `/`.
- The page is served to a logged-in admin too (no redirect). The category tile labels are 10 px at 375 (20 elements, D-M21-07).

## 3. Flows

### 3.1 Sponsor lifecycle (observed statuses + INFERRED transitions)
- **Self-registration** (S7) creates a sponsor **and** a login account (step 3), status **PENDING** ("Menunggu"; INFERRED from the S1 subtitle "Semak dan urus permohonan penaja" and the S7 note "permohonan ini akan disemak").
- **Admin creation** (S2) creates an **APPROVED** sponsor directly ("auto-diluluskan").
- Admin approves / rejects / suspends (not observable: no pending or approved sponsor exists; §9). A **SUSPENDED** sponsor is reactivated with "Aktifkan Semula" (S3; INFERRED → APPROVED).
- A sponsor logs into the role-gated portal `/sponsor`, `/sponsor/anak-angkat`, `/sponsor/anak-angkat/pool`, `/sponsor/rewards` (403 for admin; content not observable).

### 3.2 Foster-family application
1. A student, parent or teacher / counsellor submits S6 with the student's registered e-mail, a category, an optional income range and a reason.
2. The application is "Pending" / "Menunggu" on S5; admin "Lulus" → "Dalam Pool" (`approved`), "Tolak" → "Ditolak" (`rejected`) (INFERRED from the tab values).
3. A sponsor picks a pooled student (INFERRED: `/sponsor/anak-angkat/pool`) → "Ditaja" (`matched`) and an anak-angkat record; the student gets free access "selama 1 sesi persekolahan" (S6 copy; INFERRED link to M19 subscriptions — not observable).

### 3.3 Anak angkat (assignment) lifecycle
- Admin assigns directly on S4 (sponsor + student + category + channel `direct` / `mlm` "Via Agent"; INFERRED "Via Agent" = through an M24 Duta).
- Statuses: `active` "Aktif" (badge "Active") → "Graduate" → `graduated`, "Tarik" → `withdrawn`; `expired` (INFERRED: end of the school session).

## 4. Data entities implied

| Entity | Fields (observed / INFERRED) | Owner |
|---|---|---|
| Sponsor | `id` int (6–11 live), `userId` (linked sponsor login, M02 role `sponsor`), `name`, `category` (13 enum, Appendix A), `description`, `tagline`, `website`, `logoUrl`, `registrationNumber`, contact officer `contactPersonName` / `Position` / `contactEmail` / `contactPhone`, `address`, `city`, `state` (free text on S2 / S3, select on S7), `postcode`, `status` `PENDING`\|`APPROVED`\|`REJECTED`\|`SUSPENDED`, rewards count ("Hadiah"), `createdAt` ("Tarikh Daftar") | M21 (store hosted provisionally in M17 today) |
| AnakAngkat (sponsorship) | `id` int (2 live), `sponsorId`, `studentId` (M02 user), `studentCategory` `B40`\|`Asnaf`\|`Yatim`\|`OKU` (nullable "-"), `channel` `direct`\|`mlm`, `status` `active`\|`graduated`\|`withdrawn`\|`expired`, `createdAt` | M21 |
| FosterApplication | `id` int (1–3 live), `studentId` (by e-mail, M02), `applicantUserId` + applicant role (`student`\|`parent`\|INFERRED `teacher`), `studentCategory` (+ `Lain-lain`), `familyIncomeRange` (4 enum, nullable), `reason` text, `status` `pending`\|`approved`\|`matched`\|`rejected`, `createdAt` | M21 |

## 5. Figures: sources, computation and cross-module conflicts

### 5.1 Figures and their probable source

| Screen · figure | Live value | Probable source | Check |
|---|---|---|---|
| S1 "Jumlah" / "Menunggu" / "Diluluskan" / "Ditolak" / "Digantung" | 6 / 0 / 0 / 0 / 6 | count(sponsors) / by status — global | ✓ Σ status = 6 |
| S1 "{n} penaja dijumpai" | 6 (filtered: 0, 1, 6) | count(filtered query), not the page | `?page=2` still 6 |
| S1 filters | status SUSPENDED 6 (#11, 6–10), others 0; category SYARIKAT_SWASTA 6, INDIVIDU 0; search "Kedai" 1 (#6) | row filters (search on name / e-mail, INFERRED) | ✓ |
| S3 "Hadiah" | 0 on all 6 | count(rewards supplied by the sponsor) INFERRED (M15) | Perlu pengesahan |
| S4 "Jumlah Penaja" | 1 | count(distinct sponsors with an anak-angkat record) INFERRED | ≠ S1 "Jumlah" 6 (C2) |
| S4 "Pelajar Aktif Ditaja" / "Graduated" / "Withdrawn" | 1 / 0 / 0 | count(anak angkat by status) | ✓ |
| S4 tabs "Aktif" / "Graduated" / "Withdrawn" / "Expired" | 1 / 0 / 0 / 0 (global) | count by status | ✓ |
| S4 tab "Semua (n)" | 1, but 0 on the Graduated / Withdrawn / Expired tabs | count(current filtered query) | D-M21-03 |
| S5 "Menunggu" / "Dalam Pool" / "Ditaja" / "Ditolak" | 3 / 0 / 0 / 0 | count(applications by status), global | ✓ |
| M17 S1 sponsor cards | 6 · 0 Aktif · 0 · 0 · 6 | same store | ✓ = S1 |
| M02 `?role=sponsor` | 6 users | sponsor user accounts | ✓ 6 sponsors ↔ 6 users |

### 5.2 Seed values (snapshot)

**Sponsors** (all category `SYARIKAT_SWASTA` "Syarikat Swasta", status `SUSPENDED`, "Hadiah" 0, tagline empty, logo URL empty, registration number empty):

| id | Organisation | Description | Website | Tarikh | Contact / address |
|---|---|---|---|---|---|
| 11 | Alesa It Services | "Syarikat IT" | https://alesa.my | 31/03/2026 | officer name, position, e-mail, phone, address, city, state, postcode all filled (masked; seed with fictitious values) |
| 6 | Kedai Buku Popular | "Rangkaian kedai buku terbesar Malaysia. Menyediakan buku-buku pendidikan berkualiti untuk semua peringkat umur." | https://www.popular.com.my | 06/02/2026 | none ("-") |
| 7 | Faber-Castell Malaysia | "Penyedia alat tulis premium untuk pelajar. Pensil, pen warna, dan set lukisan berkualiti tinggi." | https://www.faber-castell.com.my | 06/02/2026 | none |
| 8 | KidZania Kuala Lumpur | "Taman tema pendidikan interaktif di mana kanak-kanak boleh bermain sambil belajar tentang pelbagai kerjaya." | https://www.kidzania.com.my | 06/02/2026 | none |
| 9 | Petrosains Discovery Centre | "Pusat penemuan sains interaktif di KLCC. Jelajahi dunia sains dan teknologi melalui pameran menarik." | https://www.petrosains.com.my | 06/02/2026 | none |
| 10 | PRESTASIPLUS Official | "Ganjaran rasmi dari PRESTASIPLUS — hadiah eksklusif untuk pelajar cemerlang!" | https://jombelajar.my | 06/02/2026 | none |

Each row's "Organisasi" cell shows a linked user e-mail: #6–#10 use platform demo addresses of the form `sponsor{n}@…` (n = 1–5); #11 uses a company address (masked). Ids 1–5 are absent (deleted or never used; not observable).

**Anak angkat:** #2 — sponsor #11 "Alesa It Services", one student (M02 user, DELIMa-style e-mail; masked), category `B40`, channel `direct`, status `active`, 31/03/2026. Id 1 absent.

**Applications** (all `B40`, `Pending`, id descending):
- #3 and #2 — two sibling students (school-generated e-mails, no school line "-") applied for by the **same parent** account (role `parent`); reason = the same parent-written free text (masked; 83 characters shown).
- #1 — a student applying for herself (role `student`; school line present); reason = S6 example 2 verbatim, including the leading "• " ("• Pelajar yatim piatu yang tinggal bersama nenek. Nenek sudah tua dan tiada pend...").

Rebuild seeds use fictitious names / e-mails for all of these people (privacy rule), keeping the observed structure.

### 5.3 Conflicts and questions for other modules

- **C1 — M17 provisional sponsor store = live.** 6 sponsors, 0 active, 0 pending, 0 rejected, 6 suspended: agrees with S1. M21 now supplies the full seed (ids 6–11, names, categories, dates) for the store M17 hosts; ownership moves to M21 as ADR-0014 plans.
- **C2 — "Jumlah Penaja" means two things.** S1 "Jumlah" = 6 (all sponsors) and M17 "Jumlah Penaja" = 6, but S4 "Jumlah Penaja" = 1. The S4 card is not a total of sponsors but (INFERRED) sponsors with at least one anak angkat. Different pages, no side-by-side contradiction; replicate with that definition and record it (Perlu pengesahan).
- **C3 — Active sponsorship under a suspended sponsor.** Anak angkat #2 is "Active" while its sponsor #11 is "Digantung", and the S4 sponsor select is empty (INFERRED: lists approved sponsors only). Observed data; replicate.
- **C4 — Students and parent belong to M02.** The rebuild needs 4 student anchors (1 adopted, 3 applicants of whom 2 are siblings) and 1 parent anchor linked to the 2 siblings, plus 6 sponsor-role users linked to sponsors 6–11. M02 already counts 6 sponsor users; the student / parent anchors must be placed inside M02's existing counts (no count change). → XR to M02.
- **C5 — Sponsor landing.** The architecture overview sends role `sponsor` to `/dashboard`, but live has a sponsor portal under `/sponsor` (403 for admin). The sponsor's real landing page is not observable (Perlu pengesahan).
- **C6 — M15 rewards.** "Hadiah" (S3) and `/sponsor/rewards` suggest sponsor-supplied rewards in the M15 shop. M15 discovery found no sponsor field. Not observable; flagged only.
- **C7 — M19 free access.** S6 promises "akses PERCUMA … selama 1 sesi persekolahan" once matched; how this reaches M19 subscriptions (a complimentary package?) is not observable.
- **C8 — M24 "Via Agent".** Channel `mlm` "Via Agent" INFERRED to mean an ambassador (M24 Duta) brought the sponsor. Perlu pengesahan when M24 is discovered.

### 5.4 Side-effect ledger (this discovery)

No M21 page shows a view or click counter, and none was observed to change. Every M21 URL reached the server at most once per browser context (guard cache; the cache survived the session expiry because the context stayed open). Non-M21 pages read for cross-checks: `/admin` (M17) and `/admin/users?role=sponsor` (M02), twice each (snapshot run and re-run), plus `/dashboard` once (menu link). No live value was changed.

## 6. Scripts

- **S4** Alpine search component (`query`, `results`, `showResults`, `selectedEmail`, `selectedName`; `search()` fetches `/admin/anak-angkat/cari-pelajar?q=` when `query.length >= 2`; `select(s)` fills the hidden `student_email`).
- **S6** `onclick="document.querySelector('textarea[name=reason]').value=this.innerText"` on each example.
- **S7** Alpine wizard (`step`, `loading`, `selectedCategory`, `showPassword`, `showPasswordConfirm`); the step-1 "Seterusnya" `alert('Sila pilih kategori penaja.')`.
- Confirms: "Aktifkan semula penaja ini?" (S3), "Tolak permohonan ini?" (S5). No confirm on "Lulus", "Graduate", "Tarik".
- SHU / SHA shell scripts on these pages (owned by 00-global-ui / M22 / M16; listed for reconciliation): "Accept", "translate(0, 0) scale(1)", "cubic-bezier(0.22, 0.85, 0.32, 1)", "(display-mode: standalone)", "Tekan Pasang untuk arahan pemasangan", "[App] SW registered, scope:", "[App] SW registration failed:", "[FCM] Token saved:", "[FCM] Save token failed:", "[FCM] Token error:", "[FCM] Foreground message:", "[FCM] SDK load failed:", "Maaf, berlaku ralat. Sila cuba semula.", tournament "Pendaftaran dibuka" / "Sedang berlangsung", chatbot "Apakah PrestasiPlus?", "Bagaimana cara mendaftar?", "Berapakah harga langganan?"; SHA chip title "GB /".

## 7. Endpoints observed

| Method | URL | Use | Opened? |
|---|---|---|---|
| GET | `/admin/sponsors?search=&status=&category=&page=` | S1 | yes |
| GET | `/admin/sponsors/{id}` | row "Lihat" | yes → **500** |
| GET | `/admin/sponsors/create` | S2 | yes |
| POST | `/admin/sponsors` | S2 "Tambah Penaja" | **no** |
| GET | `/admin/sponsors/{id}/edit` | S3 | yes (6 sponsors) |
| PUT (POST `_method=PUT`) | `/admin/sponsors/{id}` | S3 "Kemaskini Penaja" | **no** |
| POST | `/admin/sponsors/{id}/reactivate` | S3 "Aktifkan Semula" | **no** |
| GET | `/admin/anak-angkat?status=` | S4 | yes |
| POST | `/admin/anak-angkat/assign` | S4 "Assign" | **no** |
| POST | `/admin/anak-angkat/{id}/status` (`graduated` / `withdrawn`) | S4 "Graduate" / "Tarik" | **no** |
| GET (JSON) | `/admin/anak-angkat/cari-pelajar?q=` | S4 student search | **no** |
| GET | `/admin/anak-angkat/permohonan?status=` | S5 | yes |
| POST | `/admin/anak-angkat/permohonan/{id}/lulus`, `/tolak` | S5 | **no** |
| GET / POST | `/mohon-keluarga-angkat` | S6 | GET only |
| GET / POST | `/sponsor/register` | S7 | GET only |
| GET | `/sponsor`, `/sponsor/anak-angkat`, `/sponsor/anak-angkat/pool`, `/sponsor/rewards` | sponsor portal | 403 (admin), 302 `/login` (guest) |
| POST | `/sponsor/profile` | sponsor portal (GET = 405) | **no** |

## 8. Responsive behaviour (375 / 768 / 1280) and live defects

### 8.1 Layout per screen (measured by `tools/jobs/M21-measure.js`; SHA / SHU pages include a 15 px scrollbar)

| Screen | 375 | 768 | 1280 |
|---|---|---|---|
| S1 | stats 2 columns; table 543 px scrolls in its card; table text 9–10 px (73 elements) | stats 5; table 832 px scrolls in a 667 px card | stats 5; table fits |
| S2 | form 1 column | 2 columns, address 3 | same |
| S3 | 1 column; **status card overflows the page (scrollWidth 409)** | 2 columns | same |
| S4 | stats 2; **tab row overflows the page (397)**; table scrolls; 10 px badges | stats 4; table fits | same |
| S5 | tab cards 2; table 777 px scrolls; 10 px text (18) | tab cards 4; table scrolls (777 / 715) | fits |
| S6 | single column; 10 px note | same (centred) | same |
| S7 | tiles 2 columns; tile labels 10 px (20); H1 24 px | tiles 3; H1 48 px | same |

### 8.2 Live defects (D9 class; the rebuild decision is the URS writer's)

| ID | Defect | Class | Suggested rebuild |
|---|---|---|---|
| D-M21-01 | S1 row "Lihat" → `GET /admin/sponsors/{id}` → **500 "Ralat Pelayan"** for every sponsor | broken link | a working read-only sponsor view (or route "Lihat" to S3); minimal choice for the URS writer |
| D-M21-02 | `GET /admin/anak-angkat/{x}` and `/sponsor/profile` → unbranded Symfony 405 page | error page not branded | Perlu pengesahan (typed URLs only); follow live or the global 404 (M19 / M20 precedent) |
| D-M21-03 | S4 "Semua (n)" tab shows the count of the current filter ("Semua (0)" on Graduated while 1 record exists) | contradictory figures | "Semua" = total of all records |
| D-M21-04 | S1 `?page=2`: "6 penaja dijumpai" above "Tiada penaja dijumpai" + English Laravel pager "Showing 0 of 6 results" | contradictory text / untranslated | Perlu pengesahan (typed URL only); follow live |
| D-M21-05 | Horizontal page scroll at 375: S3 status card (+49 px), S4 status tabs (+37 px) | layout breakage | wrap / stack so the page fits 320–375 |
| D-M21-06 | S6 SHU header shows "Dashboard" / "Selamat datang kembali" instead of the page title | wrong title | header title "Mohon Keluarga Angkat" |
| D-M21-07 | Text under 12 px: S1 table 9–10 px at 375; S4 badges / buttons 10 px; S5 table 10 px; S6 note 10 px; S7 tile labels 10 px at 375 | unreadable text | minimum 12 px |
| D-M21-08 | S5 empty states embed the raw status: "Tiada permohonan approved / matched / rejected"; S3 shows raw "SUSPENDED" / "(SUSPENDED)"; S4 row raw category "SYARIKAT_SWASTA" | wrong labels | use the BM labels ("Dalam Pool", "Ditaja", "Ditolak", "Digantung", "Syarikat Swasta") |
| D-M21-09 | S6 examples copy their bullet "• " into the reason (live application #1 starts with "• ") | minor copy defect | Perlu pengesahan; follow live (harmless) |
| D-M21-10 | Mixed-language labels ("Assign", "Graduate", "Graduated", "Withdrawn", "Expired", "Active", "Pending", "Direct", "Via Agent", applicant role "parent" / "student") | inconsistent labels | follow live (D9 "when unsure, follow live"), except those in D-M21-08 |
| D-M21-11 | S2 / S3 "Negeri" is free text while S7 uses a state select | inconsistent input | Perlu pengesahan; follow live |

Not defects (replicate): only name and category required on S2; the S4 sponsor select empty while no sponsor is approved; the sponsor portal 403 for admin; guest redirects to `/login`.

### 8.3 Audit-lesson checklist
- Every route of the TRACKER checklist opened (5/5), plus 2 new routes, the sponsor portal (4 routes, 403) and 40+ probes.
- Every filter exercised by URL: S1 status 4 (+ lower-case), category 2, search match / none, page 2; S4 tabs 5; S5 tabs 4. Counts are in the snapshot.
- Client-side reveals captured: S6 example click; S7 tile, steps 2 and 3, password eye.
- Every screen captured at 375 / 768 / 1280 (S7 steps also at 375); guest view of S7 (and guest redirects of S1–S6).
- Error states: 404 (S3, S5), 500 (S3 show), 405 (S4), 403 (sponsor portal); empty states S1, S4, S5.

## 9. Open questions and states that need a live action

| # | Question | Why not observable |
|---|---|---|
| OQ-M21-01 | Sponsor portal content: `/sponsor`, `/sponsor/anak-angkat`, `/sponsor/anak-angkat/pool` (choose a pooled student), `/sponsor/rewards`, `POST /sponsor/profile`; the sponsor's landing page after login. | 403 for the admin; a sponsor account is needed (all 6 are suspended). |
| OQ-M21-02 | S3 status card for PENDING / APPROVED / REJECTED sponsors (approve / reject / suspend buttons, confirms). | All 6 sponsors are SUSPENDED. |
| OQ-M21-03 | Flash / validation messages after S2, S3, reactivate, assign, graduate, withdraw, lulus, tolak, S6 and S7 submits; the S7 success page. | Writes forbidden. |
| OQ-M21-04 | The S4 student-search dropdown rendering and `cari-pelajar` JSON shape; which students are searchable. | Typing would fetch real students' names / e-mails. |
| OQ-M21-05 | Rows for statuses graduated / withdrawn / expired (S4) and approved / matched / rejected (S5) — actions and badge colours. | No such records exist. |
| OQ-M21-06 | Where the full application reason is shown (S5 truncates at 80 characters; no tooltip or detail page). | No detail route (`/permohonan/{id}` → 404). |
| OQ-M21-07 | Which roles see "Mohon Keluarga Angkat" (student menu confirmed by roles-matrix; parent / teacher INFERRED from S6 copy) and who may open S6. | Only the admin account is available on lane 1. |
| OQ-M21-08 | How "Hadiah" is counted and linked to M15; how "akses PERCUMA … 1 sesi persekolahan" is granted (M19); what "Via Agent" refers to (M24). | No sponsor rewards / matches exist; writes forbidden. |
| OQ-M21-09 | Pagination size of S1 / S4 / S5. | 6 / 1 / 3 rows only. |

## 10. Screenshot index (`docs/discovery/img/M21/`, all masked)

- Sponsors list: admin-sponsors-desktop, admin-sponsors-tablet, admin-sponsors-mobile, admin-sponsors-empty, admin-sponsors-page-2.
- Sponsor create: admin-sponsor-create-desktop, admin-sponsor-create-tablet, admin-sponsor-create-mobile.
- Sponsor edit: admin-sponsor-edit-desktop, admin-sponsor-edit-tablet, admin-sponsor-edit-mobile, admin-sponsor-show-500.
- Anak angkat: admin-anak-angkat-desktop, admin-anak-angkat-tablet, admin-anak-angkat-mobile, admin-anak-angkat-empty, admin-anak-angkat-show-405.
- Applications: admin-permohonan-desktop, admin-permohonan-tablet, admin-permohonan-mobile, admin-permohonan-empty.
- Apply form: mohon-keluarga-angkat-desktop, mohon-keluarga-angkat-tablet, mohon-keluarga-angkat-mobile, mohon-keluarga-angkat-example.
- Sponsor registration: sponsor-register-desktop, sponsor-register-tablet, sponsor-register-mobile, sponsor-register-step-2, sponsor-register-step-3, sponsor-register-step-2-mobile, sponsor-register-step-3-mobile.

All are `.png`, 32 in total. The S3 organisation-name field and subtitle are blank / `<name>`, and the S6 "Guru / Kaunselor" line is `<person>`, because of the sanitizer's over-masking (not personal data).

## 11. Privacy check

A scripted scan of every M21 file (narrative, inventory, raw states, snapshot, crawl, job scripts) for the personal strings seen on live (officer name, officer phone, the officer / company e-mail address, the 4 student names, the parent name, the student e-mail addresses and domains, the applicant student's school) returns **0 hits**; `piiLeakCheck` = 0 in all 55 states. Unmasked scratch dumps were never written to disk; the only scratch file (`crawl-struct.json`, structure only) was deleted after `M21-crawl-post.js` ran.

## Appendix A — Enumerations

| Enum | Values → label |
|---|---|
| Sponsor category (S1 / S2 / S3 value; S7 tile icon) | `INDIVIDU` "Individu / Peribadi" (`fa-user`); `SYARIKAT_SWASTA` "Syarikat Swasta" (`fa-building`); `GLC` "Syarikat Berkaitan Kerajaan" (`fa-landmark`); `NGO` "Pertubuhan Bukan Kerajaan" (`fa-hands-helping`); `BADAN_KERAJAAN` "Badan / Agensi Kerajaan" (`fa-university`); `BANK` "Bank / Institusi Kewangan" (`fa-piggy-bank`); `UNIVERSITI` "Universiti / IPT" (`fa-graduation-cap`); `PERSATUAN` "Persatuan / Kesatuan" (`fa-users`); `KOPERASI` "Koperasi" (`fa-handshake`); `KEDAI_BUKU` "Kedai Buku / Alat Tulis" (`fa-book-reader`); `RESTORAN` "Restoran / F&B" (`fa-utensils`); `TEKNOLOGI` "Syarikat Teknologi" (`fa-laptop-code`); `PENDIDIKAN` "Penyedia Pendidikan" (`fa-chalkboard-teacher`) |
| Sponsor status | `PENDING` "Menunggu"; `APPROVED` "Diluluskan"; `REJECTED` "Ditolak"; `SUSPENDED` "Digantung" (badge `fa-ban`; S3 raw "SUSPENDED") |
| Student category | S4: `B40`, `Asnaf`, `Yatim`, `OKU` ("" "-"); S6: + labels "B40 — Pendapatan rendah", "Asnaf — Layak bantuan zakat", "Yatim — Tiada ibu/bapa", "OKU — Orang kurang upaya", and `Lain-lain` "Lain-lain" |
| Family income | `< RM1,000` "Bawah RM1,000"; `RM1,000 - RM2,500`; `RM2,500 - RM4,000`; `> RM4,000` "Atas RM4,000" |
| Channel | `direct` "Direct"; `mlm` "Via Agent" |
| Anak angkat status | `active` "Aktif" / badge "Active"; `graduated` "Graduated"; `withdrawn` "Withdrawn"; `expired` "Expired" (tab `all` "Semua") |
| Application status | `pending` "Menunggu" / badge "Pending"; `approved` "Dalam Pool"; `matched` "Ditaja"; `rejected` "Ditolak" |
| Applicant role (raw) | `student`, `parent` (teacher INFERRED from S6 "Guru / Kaunselor") |

## Appendix B — Exact DOM strings (inventory reconciliation)

Strings of the inventory not already quoted above.

- Global 404: "404", "🔍", "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama" (→ `/`), "Mula Latihan" (→ `/latih-tubi`), "PRESTASIPLUS".
- S1: stat labels "Jumlah", "Menunggu", "Diluluskan", "Ditolak", "Digantung"; column "Organisasi"; "Lihat", "Edit"; dates "31/03/2026", "06/02/2026"; pager "« Previous", "Next »", "Showing 0 of results" + "6" (the number is a separate node), page link "1" (icon `svg`).
- S3: "Status", "Hadiah", "Tarikh Daftar", "Status Penaja:", "Digantung", "(SUSPENDED)", "Aktifkan Semula", "Kemaskini Penaja", "Batal"; form `autocomplete=off` on `_token`.
- S4: "Assign Anak Angkat", "Penaja", "Cari Pelajar (nama/email)", "Kategori", "Saluran", "Assign", "Semua (1)", "Semua (0)", "Aktif (1)", "Graduated (0)", "Withdrawn (0)", "Expired (0)", "Graduated", "Withdrawn", "Jumlah Penaja", "Pelajar Aktif Ditaja", "B40", "Direct", "Active", "Graduate", "Tarik", Alpine `x-text` "' (' + selectedEmail + ')'" ("+ selectedEmail +").
- S5: "Menunggu 3", "Dalam Pool 0", "Ditaja 0", "Ditolak 0", "Pending", "Lulus", "Tolak" (icons `fa-check`, `fa-times`).
- S6: hint text node without its link (as inventoried): "Email pelajar yang berdaftar dalam PrestasiPlus. Jika pelajar belum daftar, minta mereka daftar terlebih dahulu di ."; "Email Pelajar", "Kategori Pelajar", "Anggaran Pendapatan Keluarga", "Sebab Permohonan", "Contoh sebab permohonan:", "Hantar Permohonan", "Apa yang berlaku selepas mohon?", "Siapa boleh mohon?", "Pelajar sendiri", "— mohon untuk diri sendiri", "Ibu bapa", "— mohon untuk anak", "sini".
- S7: "Pendaftaran Penaja", "Organisasi", "Hubungan", "Akaun", "Maklumat Organisasi", "Maklumat Hubungan & Alamat", "Akaun Log Masuk", "Kembali", "Seterusnya", "Menghantar...", "Sudah ada akaun? ·", "Log Masuk", "Daftar Sebagai Pelajar", "Kembali ke Laman Utama".
- Icons used across the screens: `fa-arrow-left`, `fa-arrow-right`, `fa-ban`, `fa-check`, `fa-circle`, `fa-circle-notch`, `fa-edit`, `fa-eye`, `fa-eye-slash`, `fa-home`, `fa-info-circle`, `fa-lightbulb`, `fa-lock`, `fa-paper-plane`, `fa-play-circle`, `fa-plus`, `fa-plus-circle`, `fa-save`, `fa-search`, `fa-times`, `fa-user`, plus the category icons of Appendix A.
- Form field names: `_token`, `_method`, `search`, `status`, `category`, `name`, `description`, `tagline`, `website`, `logo_url`, `registration_number`, `contact_person_name`, `contact_person_position`, `contact_email`, `contact_phone`, `address`, `city`, `state`, `postcode`, `sponsor_id`, `student_email`, `student_category`, `channel`, `family_income_range`, `reason`, `organization_name`, `email`, `password`, `password_confirmation`.
- Shell strings on SHU pages: "LIVE:", "MAIN", "DAFTAR" (tournament banner, hidden).
