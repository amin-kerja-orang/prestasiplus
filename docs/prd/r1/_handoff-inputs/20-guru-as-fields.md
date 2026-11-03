# Field and behaviour spec - SRS 20 (Guru and Admin Sekolah), PrestasiPlus V3 - merge-ready

Source: `docs/prd/r1/20-guru-admin-sekolah.md` (1779 lines). Read-only audit; no repo file was edited. Language English, UI copy exact BM. No real names or school names.

Tags: `SRS:C` the SRS already specifies it fully; `SRS:P` partial (the spec below completes it); `SRS:M` missing (the spec below is new); `[PROPOSED]` no evidence anywhere, written from PRD principles and existing code. Every row below is meant to be implemented as written. Evidence: SRS text, V2 captures (`guru_kelas__guru_kelas_cipta.txt`, `guru_set_soalan__guru_set_cipta.txt`), contract (`packages/contract/src/questions/parts.ts:156` cognitive levels; `intake/question.ts`; `intake` TP message), `60-api-contract.md` (API-GUR-01..27, API-AS-01..12).

## 0. Coverage

Second pass done. Every SRS section is now read: sections 1-2, 5 (XS-1..XS-8), all Guru modules including GUR-2 lines 341-367, GUR-5/6/10 FR/AC, GUR-7, and AS-0, A5, 1, 3-7, 10, 11, 45-53 and Delivery B (FR lines; the Delivery B V2 screen text of AS-2/A2/A3/A4 was read through its FRs and the matching Guru blocks only). Table and column names were reconciled with `apps/api/prisma/schema/{classes,reports,identity,content}.prisma` and `50-data-model-erd.md` DM-28..DM-49, and endpoints with `60-api-contract.md` API-GUR-01..28, API-AS-01..17, API-RPT-01..16. **Part 5 (reconciliation and the added screens) overrides any name or value in Part 3 that differs.** Residual honesty: AS-2 (Dashboard), AS-A2/A3/A4 reuse the Guru blocks (A2/A3/A4) and the AS-2 Delivery B card layout was read only through FR-AS-2-1..5.

---

# PART 1 - GLOBAL BEHAVIOUR (referenced by every screen as GLB-n)

## GLB-1 Message patterns (BM, exact)
| Case | Text | Where shown |
|---|---|---|
| Required text | "Sila isi {medan}." | under the field, red, field focused |
| Required select/radio | "Sila pilih {medan}." | same |
| Number range | "{Medan} mesti antara {a} dan {b}." | same |
| Max length | "{Medan} tidak boleh melebihi {n} aksara." | same |
| Duplicate (409) | "{Medan} sudah digunakan." | same |
| Several errors at submit | summary line above the form "Sila betulkan {n} medan di bawah." plus inline messages | top of form |
| TP | "Tahap Penguasaan (TP) mesti antara 1 dan 6." (contract) | inline |
| Marks | "Markah mesti antara 0 dan 100." | inline |
| Stimulus group split (422) | "Soalan dalam kumpulan rangsangan mesti dipilih bersama." | toast + picker highlight |
| Quota | "Kuota penuh! Sila tingkatkan kuota dahulu." | banner above import form |
`{medan}` is the lower-case field label without "*" (for example "Sila isi tajuk set.").

## GLB-2 Error handling per request
| Condition | Form submit / action | Page or list load | Background poll |
|---|---|---|---|
| 400/422 | inline field errors (GLB-1); form values kept | n/a | n/a |
| 401 | redirect to `/login?next={path}`; toast "Sesi anda telah tamat. Sila log masuk semula." | same | same |
| 403 | toast "Anda tidak mempunyai kebenaran untuk melakukan tindakan ini." | standard 403 page ("Akses Ditolak") | ignore silently |
| 404 | toast "Rekod tidak dijumpai." and list refresh | standard 404 page ("Halaman Tidak Dijumpai") | ignore |
| 409 | inline "{Medan} sudah digunakan." or, for a stale edit, banner "Data telah diubah oleh pengguna lain. Muat semula halaman." | n/a | n/a |
| 429 | toast "Terlalu banyak percubaan. Sila cuba sebentar lagi."; submit disabled 10 s | block "Terlalu banyak permintaan." + button "Cuba Semula" | retry after doubling interval, max 60 s |
| 5xx | toast "Sesuatu tidak kena di pihak kami. Sila cuba lagi."; form kept | standard 500 page ("Ralat Pelayan", buttons "Halaman Utama", "Cuba Semula") | keep old values, no message |
| Network failure | toast "Tiada sambungan internet. Sila semak rangkaian anda."; form kept; button re-enabled | block "Tiada sambungan." + "Cuba Semula" | keep old values |
| Timeout (20 s; uploads 120 s) | same as network failure | same | same |
Rule: another teacher's object returns 404 everywhere (FR-X2-2); the SRS exceptions that say 403 (AC-GUR-4-2 pupil, AC-GUR-43-6 class) stay 403 because the resource is a report on a known pupil/class; cross-school objects of the school admin are 404. Double-submit guard: while a request runs the button is disabled and shows its busy text ("Menyimpan...", "Menjana...", "Mengimport...", "Memuat naik...").

## GLB-3 Loading / empty / partial
- Loading: skeleton rows (lists), skeleton cards (KPI), text "Memuatkan..." under the title for screens without skeleton.
- Partial failure of one panel: that panel shows "Data tidak dapat dimuatkan." and a button "Cuba Semula"; other panels stay.
- Generic list empty after filter: "Tiada rekod sepadan dengan tapisan ini." with link "Set semula tapisan" (clears filters). First-time empty states are the exact V2 copy quoted per screen.

## GLB-4 Pagination, sort, search
- Pager copy: "Menunjukkan {a} hingga {b} daripada {n} keputusan", "Sebelumnya", "Seterusnya"; numbered pages; page in query `?page=`.
- Page size: 20 (Soalan Saya, Soalan Berstruktur, Databank, Set picker 50 per scroll), 25 (all Admin Sekolah lists, Headcount table, Prestasi ranking, any table over 50 rows), 10 (Top lists), 5 (Top Performers, Paling Meningkat).
- Search: submitted by Enter or by its button (V2 pattern; no live search); case-insensitive, diacritics-insensitive, substring match; minimum 2 characters ("Taip sekurang-kurangnya 2 aksara." if shorter); trimmed.
- Filters survive the page change and range-pill change (query string).
- Time zone for every "hari ini", week, month: `Asia/Kuala_Lumpur`; week Monday 00:00 to Sunday 23:59.

## GLB-5 Confirm dialogs (title / body / buttons, exact)
| Id | Trigger | Title | Body | Buttons (cancel / confirm) |
|---|---|---|---|---|
| CF-01 | Padam set (8b) | "Padam Set Soalan?" | "Padam set \"{title}\"? Tindakan ini tidak boleh diundur." | "Batal" / "Ya, Padam" |
| CF-02 | Padam soalan (44, 44a) | "Padam Soalan?" | "Padam soalan #{id}? Tindakan ini tidak boleh dibatalkan." | "Batal" / "Ya, Padam" |
| CF-03 | Padam Headcount | "Padam Headcount?" | "Anda pasti mahu padam headcount {subjek} ({n} Simulasi, {tahun})?" + "Semua data murid, TOV, ETR, OTR, AR & RS akan dipadam secara kekal." | "Batal" / "Ya, Padam" |
| CF-04 | Reset Data | "Reset Semua Data?" | "Semua markah murid akan dikosongkan — TOV, ETR, OTR, AR & RS." + safe list "Senarai murid (tidak dipadam)", "Tetapan headcount (subjek, kelas, tahun)" | "Batal" / "Ya, Reset" |
| CF-05 | Kurangkan OTR | "Kurangkan Bilangan OTR?" | "OTR{k} ke atas mempunyai markah. Padam markah tersebut?" | "Batal" / "Ya, Padam" |
| CF-06 | Batal remedial | "Batal & Jana Semula" | "Batal set soalan remedial untuk {nama}? Anda boleh jana semula selepas ini." | "Kembali" / "Ya, Batal" |
| CF-07 | Padam misi [PROPOSED] | "Padam Misi?" | "Padam misi \"{tajuk}\"? Ganjaran yang telah diberikan kekal." | "Batal" / "Ya, Padam" |
| CF-08 | Keluarkan pelajar [PROPOSED] | "Keluarkan Pelajar?" | "Keluarkan {nama} daripada kelas {kelas}? Akaun pelajar tidak dipadam." | "Batal" / "Ya, Keluarkan" |
| CF-09 | Scan lencana [PROPOSED] | "Imbas Lencana?" | "Imbas dan anugerahkan lencana kepada pelajar yang layak?" | "Batal" / "Ya, Imbas" |
| CF-10 | Gugurkan murid [PROPOSED] | "Gugurkan Murid?" | "Gugurkan {n} murid daripada headcount ini? Murid tidak lagi melihat headcount ini." | "Batal" / "Ya, Gugurkan" |
| CF-11 | Jadikan Draf [PROPOSED] | "Jadikan Draf?" | "Set ini tidak lagi kelihatan kepada pelajar. Rekod jawapan yang telah ada kekal." | "Batal" / "Ya, Jadikan Draf" |
| CF-12 | Reset kata laluan [PROPOSED] | "Tetapkan Semula Kata Laluan?" | "Tetapkan semula kata laluan {nama}? Kata laluan baharu dipaparkan sekali sahaja." | "Batal" / "Ya, Tetapkan" |
| CF-13 | Padam kertas peperiksaan [PROPOSED] | "Padam Kertas?" | "Padam kertas \"{nama}\"? Tindakan ini tidak boleh diundur." | "Batal" / "Ya, Padam" |
| CF-14 | Hantar import pelajar [PROPOSED] | none (no dialog; preview step is the confirmation) | | |
Dialogs are bottom sheets at 375 (RP-MODAL); Escape and the overlay cancel.

## GLB-6 Export formats
- CSV: UTF-8 with BOM, comma delimiter, CRLF, header row, dates `dd/mm/yyyy`, numbers with `.` decimal, filename `{modul}-{yyyymmdd}.csv`. Never any password, IC or e-mail of a pupil in a teacher export.
- Print/PDF: A4 portrait, no sidebar/header/buttons, print title line, footer "© PRESTASIPLUS".

---

# PART 2 - OPTION SETS (define once; screens reference OPT-xx)

| OPT id | Definition |
|---|---|
| OPT-TINGKATAN | Display order, label -> stored `education_level` (grade) : "Tingkatan 1"->1, "Tingkatan 2"->2, "Tingkatan 3"->3, "Tingkatan 4"->4, "Tingkatan 5"->5. Darjah is never offered (D72/D96/D101). Per-screen placeholder (first option, value empty): Set Soalan "— Tiada —"; Set Soalan filter "Semua tingkatan"; 44a "-- Semua tahap --"; Hantar Kertas "-- Semua / Tidak Pasti --"; Berstruktur "Semua"; AS filters "Semua Tingkatan"; Kelas form "-- Pilih tingkatan --". Headcount Auto-Setup checkbox labels "T1".."T5" -> 1..5. |
| OPT-SUBJEK | 31 subjects, stored value = `subjects.id` (M03), label = BM name. Order "V2": Bahasa Melayu, Bahasa Inggeris, Matematik, Sains, Sejarah, Pendidikan Islam, Pendidikan Moral, Matematik Tambahan, Fizik, Kimia, Biologi, Geografi, Pendidikan Seni Visual, Pendidikan Muzik, Pendidikan Jasmani & Kesihatan, Reka Bentuk & Teknologi, Sains Komputer, Bahasa Arab, Bahasa Cina, Bahasa Tamil, Prinsip Perakaunan, Ekonomi, Perniagaan, Pendidikan Al-Quran & As-Sunnah, Tasawwur Islam, Jawi, Pendidikan Syariah Islamiah, Sains Rumah Tangga, Pembuatan Pakaian Wanita, Pertanian, Sains Sukan. Variant "A-Z" (Analisa Item, Berstruktur filter, Kertas, Gambar Rajah): same 31 sorted by BM name ascending with Malay collation. Per-screen placeholder: forms "-- Pilih subjek --" (Kertas "— Pilih Subjek —", Kelas form "— Tiada —"), filters "Semua Subjek" (Analitik, Analisa Item), "Semua subjek" (Set Soalan filter), "Semua Mata Pelajaran" (Gambar Rajah), "Semua" (Berstruktur). Source `GET /api/subjects?active=1` [PROPOSED name; reuse the existing M03 subject list endpoint]. Where the screen needs only subjects with Tingkatan 1-5 content (Soalan by Chapter, Heatmap) the list is filtered to subjects with at least one servable question. |
| OPT-KESUKARAN | "⭐ — Sangat mudah"->1, "⭐⭐ — Mudah"->2, "⭐⭐⭐ — Sederhana"->3, "⭐⭐⭐⭐ — Sukar"->4, "⭐⭐⭐⭐⭐ — Sangat sukar"->5; stored `questions.difficulty` smallint 1..5; list display "⭐" repeated n times; no default; placeholder "-- Pilih kesukaran --". |
| OPT-TP | "1","2","3","4","5","6" -> 1..6; stored `questions.tp`; label "Tahap Penguasaan (TP)"; placeholder "-- Pilih TP --"; error "Tahap Penguasaan (TP) mesti antara 1 dan 6.". |
| OPT-ARAS | Bloom cognitive level, stored = contract `QUESTION_COGNITIVE_LEVELS` (`packages/contract/src/questions/parts.ts:156`): "Mengingat"->`mengingat`, "Memahami"->`memahami`, "Mengaplikasi"->`mengaplikasi`, "Menganalisis"->`menganalisis`, "Menilai"->`menilai`, "Mencipta"->`mencipta`. Label "Aras Pemikiran"; placeholder "-- Pilih aras --". KBAT chip derived (not stored): Mengingat/Memahami = "LOTS", Mengaplikasi = "MOTS", Menganalisis/Menilai/Mencipta = "HOTS". (BM labels are [PROPOSED] from the enum.) |
| OPT-KERTAS | "Soalan Umum"->`umum`, "Trial Paper"->`trial`, "Soalan DSKP"->`dskp`, "Buku Teks"->`buku_teks`, "Buku Latihan"->`buku_latihan`, "Soalan Peperiksaan"->`peperiksaan`, "Lain-lain"->`lain` (last, select only; the six information chips omit "Lain-lain"); placeholder "-- Pilih Jenis --"; stored values [PROPOSED] on `intake_batches.paper_type`. |
| OPT-ROLE | stored `users.role`: "Pelajar"->`student`, "Guru"->`teacher`, "Admin Sekolah"->`school_admin`, "Pegawai PPD"->`ppd_officer`, "Admin"->`admin`. A school admin sees Pelajar and Guru only (list filters); the role control on the pupil form is read-only text. |
| OPT-STATUS-SOALAN | `review`="Menunggu Semakan" (amber chip), `approved`="Diluluskan" (green), `draft` returned by admin="Ditolak" (red, shows the rejection reason). |
| OPT-STATUS-SET | `draft`="Draf", `published`="Diterbitkan". |
| OPT-STATUS-TIKET | `open`="Dibuka", `in_progress`="Dalam Proses", `waiting_reply`="Menunggu Balas", `resolved`="Selesai", `closed`="Ditutup"; tab "Semua" = no filter. |
| OPT-STATUS-AKAUN | list filter "Semua" (empty), "Aktif"->`active`, "Tidak Aktif"->`inactive` (includes pending and suspended); edit radios "Aktif (boleh log masuk)"->`active`, "Digantung"->`suspended`; teacher pending list = `pending`. |
| OPT-STATUS-MISI | none stored; display only "Global" badge for platform missions. |
| OPT-KELAS-OWN | Source `GET /api/guru/classes` (API-GUR-01): classes of `classrooms.teacher_id = me`, active, current and past years excluded unless `year` filter is chosen; option label = class name; value = `classrooms.id`; sort `education_level` ascending then name ascending (Malay collation); first option per screen: "Semua Kelas" (filters), "-- Pilih kelas --" (forms), "Semua kelas saya" (Misi). Empty teacher: the control is disabled and shows the screen's no-class copy. |
| OPT-JULAT | Pills "7 Hari"->7, "30 Hari"->30 (default), "3 Bulan"->90; query `range`; any other value is treated as 30. |
| OPT-TEMPOH-AS | select "Semua Masa"->`all` (default), "7 Hari"->7, "30 Hari"->30, "3 Bulan"->90. Statistik Penggunaan pills "Hari Ini"->1, "7 Hari"->7, "30 Hari"->30 (default 30). |
| OPT-RISIKO | select "Semua Risiko"->empty (default), "Kritikal"->`kritikal`, "Tinggi"->`tinggi`, "Sederhana"->`sederhana`, "Rendah"->`rendah`; row-only value "Belum Bermula"->`belum_bermula` (no answers; not selectable). Rules: accuracy < 40 Kritikal; < 55 Tinggi; < 70 Sederhana; otherwise Rendah (accuracy rounded to a whole number first). |
| OPT-KESUKARAN-ITEM | Analisa Item filter: "Semua Tahap"->empty (default), "> 70% (Mudah)"->`mudah`, "40–70% (Sederhana)"->`sederhana`, "< 40% (Sukar)"->`sukar`. Bands on % Betul rounded to whole: > 70 Mudah; 40 to 70 inclusive Sederhana; < 40 Sukar. |
| OPT-ENGAGEMENT | Non-overlapping integer bands over each pupil's all-time answers in scope (no code defines the bands; SRS FR-GUR-11-5 gives ">50, 20-50, 5-20, <5, 0" which overlap, so the bands are [PROPOSED] and recorded as a PRD correction): "Champion" >= 51 (display range text ">50 soalan"); "Konsisten" 20 to 50 ("20-50 soalan"); "Berkembang" 5 to 19 ("5-19 soalan"); "Minimum" 1 to 4 ("1-4 soalan"); "Tidak Terlibat" 0 ("0 soalan"). (Equivalent to the coordinator's 0-4 / 5-19 / 20-49 / >=50 only if the user prefers the boundary 50 in Konsisten; this spec keeps the SRS words ">50" for Champion, so 50 is Konsisten.) The display text for Berkembang and Minimum is corrected to "5-19 soalan" and "1-4 soalan" so no number appears in two tiles. |
| OPT-GRED | A+ 90-100, A 80-89, A- 70-79, B+ 65-69, B 60-64, C+ 55-59, C 50-54, D 45-49, E 40-44, G < 40, after rounding to whole (half away from zero); grade points A+ 0, A 1, A- 2, B+ 3, B 4, C+ 5, C 6, D 7, E 8, G 9; GPS = mean grade point. |
| OPT-NEGERI | "Semua Negeri" then Johor, Kedah, Kelantan, Kuala Lumpur, Labuan, Melaka, Negeri Sembilan, Pahang, Perak, Perlis, Pulau Pinang, Putrajaya, Sabah, Sarawak, Selangor, Terengganu. NOT shown to Admin Sekolah (scope is one school, SC-AS); shown only in the Admin Pusat/PPD views. |
| OPT-JENIS-INTERVENSI | "Akademik (prestasi rendah)"->`akademik`, "Kesejahteraan / mood"->`kesejahteraan`, "Kehadiran"->`kehadiran`, "Lain-lain"->`lain`; placeholder "-- Pilih jenis --". |
| OPT-HEATBAND | "Mahir (75%+)" accuracy >= 75; "Sederhana (50-74%)" 50 to 74; "Lemah (<50%)" < 50; "Belum Cuba" no answers, cell shows "-". |
| OPT-BULAN | "Januari","Februari","Mac","April","Mei","Jun","Julai","Ogos","September","Oktober","November","Disember" -> 1..12; chart short labels Jan, Feb, Mac, Apr, Mei, Jun, Jul, Ogo, Sep, Okt, Nov, Dis. |
| OPT-LATAR-AGAMA | REAL values from the existing V3 page `src/modules/m01-authentication/pages/TetapanPage.vue:18-25` (`FAITH_OPTIONS`) and type `Faith` in `api/types.ts:82`. Control: select `id="faith"`, section heading "🌍 Latar Agama (opsyen)", sub-text "Bagi konteks supaya AI dan content lebih relevan. Tidak diwajibkan.", row label "Agama / kepercayaan", help "Untuk mod rohani yang sesuai. Future: Hindu/Buddhist/Christian content akan ditambah." Options in order, label -> stored: "— Tidak nyatakan —" -> sentinel `NO_FAITH` (value not sent / null); "Islam" -> `muslim`; "Hindu" -> `hindu`; "Buddha" -> `buddhist`; "Kristian" -> `christian`; "Tiada" -> `none`. Default = stored value, else "— Tidak nyatakan —". Stored in `user_settings` (contract `account/schema.ts` settings; `spiritualMode` boolean beside it). The earlier invented list (Sikh, Lain-lain, `islam`...) is withdrawn. (The "AI" word in the sub-text is existing copy; ALESA/AI surfaces are hidden by D73, so the sentence is shown as: "Bagi konteks supaya kandungan lebih relevan. Tidak diwajibkan." [PROPOSED copy change].) |

---

# PART 3 - FIELD & BEHAVIOUR SPEC PER SCREEN

Table columns: Field label | Type, required, default | Options / data source | Validation + BM error | Depends on | SRS status.

## R1-GUR-8 Kelas Saya (`/guru/kelas`, `/guru/kelas/cipta`, `/guru/kelas/:id/edit`)
APIs: API-GUR-01/02/03/05/06. DM: `classrooms`, `enrolments`.
| Field | Type/Req/Default | Options / source | Validation + error | Depends | SRS |
|---|---|---|---|---|---|
| Nama Kelas | text, required, empty | max 100 chars | "Sila isi nama kelas."; > 100 "Nama kelas tidak boleh melebihi 100 aksara."; unique per teacher + Tahun Sesi (case-insensitive, trimmed) else 409 "Nama kelas sudah digunakan." | - | P |
| Tingkatan | select, required, placeholder "-- Pilih tingkatan --" | OPT-TINGKATAN | "Sila pilih tingkatan." | - | P |
| Subjek (pilihan) | select, optional, "— Tiada —" | OPT-SUBJEK | none | - | C |
| Tahun Sesi | number, required, default current calendar year (MYT) | integer 2020..2100 | "Tahun sesi mesti antara 2020 dan 2100." | - | P |
- Teacher with no school: form replaced by "Akaun anda belum dipautkan ke sekolah. Sila hubungi pentadbir." (exact, SRS). Success on create: redirect to `/guru/kelas`, toast "Kelas dicipta." Success on edit: "Kelas dikemaskini." Counter "{n} kelas · {n} pelajar" (distinct pupils). Empty list: "Belum ada kelas. Cipta kelas pertama anda untuk mula."
- Edit page, card "Tambah Pelajar Baharu": "Nama" (text, required, max 255; "Sila isi nama."), "Kelas" (read-only, this class), "No. IC" (text, optional; exactly 12 digits, no hyphen; "No. IC mesti 12 digit tanpa sempang."; duplicate 409 "No. IC sudah didaftarkan."), button "Cipta & Tambah". Success message exactly "Pelajar dicipta. Login: {username} / {kata laluan lalai}" (shown once, stays until dismissed; default password read from configuration). Username generation [PROPOSED]: lower-case name words joined by "." + 2-digit suffix until unique in the school (example `murid.contoh01`).
- Card "Tambah pelajar sedia ada": combobox "Cari pelajar..." (type-ahead, min 2 characters, 20 results) over pupils of the teacher's school that are active, Tingkatan 1-5 and not in this class, sorted by name ascending, display "{nama} · {Tingkatan n}"; button "Tambah"; none found: "Tiada pelajar dijumpai." Member list columns Nama, Tingkatan, Terakhir Aktif; row action "Keluarkan" (CF-08); empty "Belum ada pelajar dalam kelas ini."; success toasts "Pelajar ditambah." / "Pelajar dikeluarkan."
- Removing a class that has members is not offered (no delete in V2). 
- Enrolment states `active` -> `removed` (Keluarkan, by teacher); re-adding creates `active` again; side effect: counts XS-1 update everywhere on next load.

## R1-GUR-41 Pelajar Saya (`/guru/pelajar`)
| Field | Type/Req/Default | Options / source | Validation + error | Depends | SRS |
|---|---|---|---|---|---|
| Tab "Pelajar Saya" / "Pelajar Sekolah" | tabs, default "Pelajar Saya" | count badge on each | n/a | - | P |
| Cipta Pelajar: Nama / Kelas / No. IC | as GUR-8 edit; Kelas select OPT-KELAS-OWN with placeholder "-- Pilih kelas --", preselected when the teacher has exactly one class | | as GUR-8 plus "Sila pilih kelas." | - | P |
| "Tambah pelajar ke:" class select (Pelajar Sekolah) | select, required before add, "-- Pilih kelas --" | OPT-KELAS-OWN | "Sila pilih kelas dahulu." | - | C |
| Cari (Pelajar Sekolah) | text, optional, placeholder "Cari nama pelajar..." | name or username substring, GLB-4 | min 2 chars | - | P |
- Pelajar Saya columns: Pelajar (name; username beneath), Kelas, Tahap (the pupil's "Tingkatan n"), Tugasan (count of Set Soalan sets and Misi assigned to the pupil's class that the pupil has completed, integer), Skor Purata (mean of per-session accuracies, whole number with "%", "—" without sessions), Terakhir Aktif (`dd/mm/yyyy` of the latest answer, "—" none). Default sort name ascending; 25 per page. Empty: "Belum ada pelajar dalam kelas anda" / "Buat kelas dan tambah pelajar dari senarai sekolah." with button "Cipta Kelas". Pelajar Sekolah without school: "Sekolah belum ditetapkan" / "Sila tetapkan sekolah anda di Profil atau semasa cipta kelas untuk melihat senarai pelajar sekolah." / "Tetapan Profil".
- Add/remove from Pelajar Sekolah row: button "Tambah" or "Keluarkan" (CF-08), success toast as GUR-8; no class chosen shows the error above.

## R1-GUR-8b Set Soalan (`/guru/set-soalan`, `/cipta`, `/:id`, `/:id/keputusan`)
APIs: `GET/POST /api/guru/question-sets`, `GET/PUT /:id`, `POST /:id/status {status}`, `POST /:id/copy {classroomIds}`, `DELETE /:id`, results `GET /:id/results?classroomId=` (60 §2.17). DM: `question_sets` [PROPOSED name] with `status`, `title`, `subject_id`, `education_level_id`, `question_set_items`, `question_set_classrooms(set_id, classroom_id)`.
| Field | Type/Req/Default | Options / source | Validation + error | Depends | SRS |
|---|---|---|---|---|---|
| Tajuk Set | text, required (draft too), empty | max 150 | "Sila isi tajuk set."; "Tajuk set tidak boleh melebihi 150 aksara." | - | P |
| Subjek | select, required, "-- Pilih subjek --" | OPT-SUBJEK | "Sila pilih subjek." | - | P |
| Tingkatan (pilihan) | select, optional, "— Tiada —" | OPT-TINGKATAN | none | - | C |
| Kelas | multi-select (checkbox list), required to publish, none ticked | OPT-KELAS-OWN (no placeholder; heading "Kelas", help "Pilih kelas yang akan melihat set ini.") | on "Terbitkan" with none: "Pilih sekurang-kurangnya satu kelas sebelum menerbitkan." | - | P |
| Tapis Bank: Semua subjek / Semua tingkatan | select x2 | OPT-SUBJEK, OPT-TINGKATAN; initial values = the set's Subjek and Tingkatan once chosen, else "Semua" | none | - | C |
| Cari teks soalan... | text | GLB-4 search over question text | | - | C |
| Tapis | button | reloads picker, page 1 | | | C |
| Pilih Soalan Dari Bank | checkbox list | approved + servable questions only; newest first; 50 per scroll batch; row = preview of 120 characters + "..." , second line "{subjek} · {Tingkatan n} · ⭐{kesukaran}" (stars = difficulty 1..5), figure shown inline; a stimulus group is one row with one checkbox | 0 chosen at publish or draft save: "Pilih sekurang-kurangnya satu soalan."; more than 100: "Satu set boleh mengandungi paling banyak 100 soalan."; group split: GLB-1 stimulus message | filter | P |
| Counter | "{n} dipilih" | | | | C |
- Buttons "Batal" (back, no save), "Simpan Draf" (needs title, subject and >= 1 question; classes optional), "Terbitkan" (needs all of those and >= 1 class).
- State machine: `draft` -> `published` by teacher "Terbitkan" (side effect: appears in Murid 26 and Dashboard "Set Soalan Dari Cikgu" for pupils of the ticked classes only); `published` -> `draft` by "Jadikan Draf" (CF-11; attempts kept); any -> deleted by "Padam" (CF-01; attempt rows kept for Prestasi). Editing a published set: title and classes editable; the question list is locked once any pupil has an attempt ("Soalan tidak boleh diubah kerana pelajar telah menjawab set ini."). "Salin": dialog "Salin Set ke Kelas", select "Pilih Kelas Sasaran" with "-- Pilih kelas --" (error "Sila pilih kelas sasaran."), note "Set baharu akan dicipta sebagai draf dengan semua soalan disalin.", "Batal"/"Salin"; result is a `draft` assigned to the chosen class, title "{title} (Salinan)".
- List: counters "Diterbitkan", "Draf", "Penyertaan" (pupils with >= 1 completed attempt on any set of the teacher); set card shows title, status chip (OPT-STATUS-SET), subject, "{n} soalan", "{n} siap" (pupils that finished), buttons "Hasil", "Urus →", "Salin", "Terbit"/"Jadikan Draf", "Padam"; sort newest updated first. Empty: "Belum ada set soalan" / "Cipta set soalan tersendiri dan kongsi dengan kelas anda." / "Cipta Set Pertama".
- Results: select "Kelas" (first option "Semua Kelas", then the classes ticked on the set), cards "Penyertaan", "Skor Purata" (mean of round(correct ÷ total × 100) per attempt, whole %), "Jumlah Percubaan"; table # · Pelajar · Skor ("{betul}/{jumlah}") · Ketepatan (colour >= 70 green, >= 50 amber, else red) · Tarikh (`dd/mm/yyyy`), newest first, 25 per page; empty "Belum ada pelajar menjawab set ini."; link "Kembali ke Set Soalan".
- Success toasts: "Draf disimpan.", "Set diterbitkan.", "Set dijadikan draf.", "Set dipadam.", "Set disalin."

## R1-GUR-2b Misi Harian (`/guru/misi-harian`)
APIs: API-GUR-11. DM: `daily_missions` [PROPOSED name; M05 owns].
| Field | Type/Req/Default | Options / source | Validation + error | SRS |
|---|---|---|---|---|
| Tajuk Misi | text, required, placeholder "cth: Jawab 20 soalan Matematik" | max 255 | "Sila isi tajuk misi."; "Tajuk misi tidak boleh melebihi 255 aksara." | P |
| Keterangan (opsional) | textarea, optional, placeholder "cth: Fokus Bab 3 Algebra sebelum ujian" | max 500 | "Keterangan tidak boleh melebihi 500 aksara." | P |
| Sasaran Soalan | integer, required, default 10 | 1..1000 | "Sasaran soalan mesti antara 1 dan 1000." | P |
| Ganjaran Syiling | integer, required, default 10 | 0..10000 | "Ganjaran syiling mesti antara 0 dan 10000." | P |
| Tarikh | date, required, default today | today or later | "Tarikh tidak boleh lebih awal daripada hari ini." | P |
| Kelas (opsional) | select, default "Semua kelas saya" | OPT-KELAS-OWN | none | C |
- "Misi Baru" shows the form; "Cipta Misi" saves; success "Misi dicipta."; list sort date descending then created descending; card layout per SRS; delete only own missions (CF-07; a Global mission has no delete: API 403 "Misi global tidak boleh dipadam."); empty "Belum ada misi" / "Cipta misi harian pertama untuk pelajar anda." / "Cipta Misi". Reward rule: the reward is paid once when the pupil reaches the sasaran; deleting keeps paid rewards.

## R1-GUR-3 Headcount (`/headcount` and sub-routes)
APIs: existing list/dashboard/form-options/create/auto-setup/summary/export/detail/drop/reset/delete + new `PUT /api/headcount/:id/results/:n`, `PUT /api/headcount/:id/targets`, `PUT /api/headcount/:id/settings`, `PUT /api/headcount/subject-defaults` (card "Simpan Sasaran") [PROPOSED names; `60` F-11]. DM: `headcount_configs` (+ per-pupil rows), subject default table `[PROPOSED] headcount_subject_defaults(teacher_id, subject_id, year, tov, rs)`.
| Field | Type/Req/Default | Options / source | Validation + error | Depends | SRS |
|---|---|---|---|---|---|
| Subject card TOV | decimal, optional, empty | 0..100, 1 decimal, step 0.1 | "Markah mesti antara 0 dan 100." | card per active subject in OPT-SUBJEK order | P |
| Subject card RS (Sasaran) | decimal, optional | 0..100, 1 decimal; RS < TOV allowed, Jurang shows "-n" | same | | P |
| Jurang | computed | RS − TOV, 1 decimal, sign shown ("+40", "-5", "0"); "—" if either empty | | | C |
| AR pill | computed | "AR {n}%" whole number, "AR —" none | | | C |
| Simpan Sasaran | button | saves every card that changed; success "Sasaran disimpan."; failure "Gagal menyimpan sasaran. Cuba lagi." | | | P |
| Auto-Setup Tingkatan | checkbox group T1..T5, none ticked | OPT-TINGKATAN short labels; "Auto-Setup ({n})" disabled while n = 0 | result: "{n} headcount dicipta."; none new: "Tiada headcount baharu untuk dicipta." | | P |
| Pilih Kelas | select, required, "-- Pilih kelas --" | OPT-KELAS-OWN | "Sila pilih kelas." | | P |
| Pilih Subjek | select, required, "-- Pilih subjek --" | OPT-SUBJEK, option text "{nama} ({KOD})"; if the class has a Subjek it is preselected and the list still allows change | "Sila pilih subjek." | class | P |
| Tingkatan | read-only text from the class | OPT-TINGKATAN | | class | P |
| Tahun Akademik | integer, required, default current year | 2020..2100 | "Tahun mesti antara 2020 dan 2100." | | P |
| Bilangan OTR | radio 2/3/4/5, default 3 | hint "Minimum 2 OTR · Default 3 OTR · Boleh tukar 2/3/4/5 ikut keperluan kelas." | | | C |
| Mod Pengiraan Markah | radio cards, default Auto | "🤖 Auto — Markah dikira automatik dari soalan latih tubi SPM + Tracking A pelajar di platform PrestasiPlus."->`auto`; "✍️ Manual — Cikgu key-in markah pelajar sendiri (cth: dari peperiksaan formal sekolah)."->`manual` | duplicate 409: "Headcount Auto untuk kelas, subjek dan tahun ini sudah wujud." / "Headcount Manual untuk kelas, subjek dan tahun ini sudah wujud." | | P |
| Dashboard "Tapis:" | chips, default "Semua ({n})" | then one chip per Tingkatan present, label "Tingkatan n ({n})" | | | P |
| "Susun:" | toggle, default "Ranking" | "Ranking" = latest AR descending, pupils without AR last, tie by name; "A-Z" = name ascending (Malay collation) | | | P |
| Row checkboxes | select-all + per row | bar "{n} murid dipilih", buttons "Gugurkan" (CF-10), "Kembalikan", "Batal" | | | P |
| Key-in AR (Manual only) | decimal per pupil, empty allowed | 0..100 step 0.1; `n` outside 1..activeOtrs = 404 | "Markah mesti antara 0 dan 100."; success "AR OTR{n} disimpan." | | C |
| Edit TOV / ETR | decimal x2 per pupil | 0..100 step 0.1; default = the subject-card default | "Markah mesti antara 0 dan 100."; success "TOV/ETR disimpan." | | P |
| RS (SPM Sebenar) | decimal per pupil, optional, on Edit TOV/ETR page, column "RS (SPM Sebenar)" | 0..100 1 decimal | same message | | M |
| Tarikh Rekod RS | date, optional, set automatically on first save, editable | not in the future: "Tarikh tidak boleh lebih lewat daripada hari ini."; displayed "Direkodkan: {dd Mon yyyy}" | | RS | M |
| Tetapan: Bilangan OTR | select 2..5 | lowering below an OTR that has marks opens CF-05 | | | C |
- Calculations (HC-SPEC, SRS C): OTR_k = round(TOV + (ETR − TOV) × r_k), r_k = floor(100·k/n)/100, OTR_n = ETR; grade by OPT-GRED; Auto AR = round(correct ÷ answered × 100) over `practice_answers` of all modes for the subject and year; status per checkpoint On Track when AR >= OTR_k, else Below; pupil status = latest checkpoint with an AR; config On Track % = round(on ÷ (on + below) × 100); Ringkasan bands Above (AR − OTR > 2), On Track (0..2), Below (< 0), Belum Diisi; Unjuran end = ETR if AR >= TOV else AR, trend Meningkat (> AR + 2) / Menurun (< AR − 2) / Stabil, Keyakinan Tinggi (AR >= ETR) / Sederhana (AR >= TOV) / Rendah. Rounding: half away from zero. Refresh: on page load only; no polling.
- Export CSV `headcount-{subjek}-{kelas}-{yyyymmdd}.csv`: columns "Bil","Nama","TOV","OTR1","AR1",...,"OTR{n}","AR{n}","ETR", then last row "Purata Kelas" (mean of non-empty values, 1 decimal). Order = current sort.
- Empty states: "Belum ada headcount." / "Buat Sekarang"; class with no pupils: "Belum ada murid dalam kelas ini."; no pupil has AR in Auto: AR cells "—".
- Statuses of a pupil entry: `Active` (has TOV and ETR, own or default) / `Draft` (otherwise), `dropped` via Gugurkan.
- AS-3 (SRS read: FR-AS-3-1..6): read-only copy of the GUR-3 screens for all configs of the school's classes (DM-29: through `classrooms.school_id`); the list and dashboard add the column/line "Guru" (teacher name) beside class and subject; the dashboard filter "Tapis:" chips as GUR-3 ("Semua ({n})" + "Tingkatan n ({n})"); no filter select exists in V1/SRS, none is added. Absent controls: "Buat Baru", "Auto-Setup", "Key-in AR", "Edit TOV/ETR", "Tetapan", "Reset Data", "Padam", "Gugurkan"/"Kembalikan", "Simpan Sasaran"; every write endpoint answers 403 for `school_admin` ("Anda tidak mempunyai kebenaran untuk melakukan tindakan ini."). Sort "Susun:" and calculations as GUR-3. "{n} entri headcount" = the AS-3 list count.

## R1-GUR-4 Prestasi (`/prestasi/kelas`)
| Field | Type/Req/Default | Options / source | Validation | SRS |
|---|---|---|---|---|
| Class cards (picker) | list | OPT-KELAS-OWN, card = name, Tingkatan, pupils | empty "Anda belum mempunyai kelas aktif." / "Cipta kelas terlebih dahulu untuk mula memantau prestasi murid." / "Cipta Kelas" | C |
| Tukar Kelas... | select | OPT-KELAS-OWN, default current | | C |
| Kedudukan Murid | table | columns # · Nama · Sesi · Soalan · Ketepatan · Headcount · Terakhir Aktif · Aksi "Lihat →"; default sort Ketepatan descending, ties by Soalan descending then name; header click toggles asc/desc on Nama, Sesi, Soalan, Ketepatan, Terakhir Aktif; 25 per page | | P |
| Pelajar Terbaik | list | top 10 pupils with >= 5 answers by Ketepatan descending (ties: Soalan descending); row = rank, name, "{x}% · {n} soalan"; empty "Tiada pelajar dengan sekurang-kurangnya 5 soalan." | | M |
| Prestasi Mengikut Subjek | rows | subjects with answers, accuracy descending, "{subjek} {x}% · {n} soalan" with bar; empty "Belum ada data latihan." | | C |
- Percentages capped at 100. 403 for another teacher's pupil. Refresh on load.

## R1-GUR-5 Analitik Adaptif (`/analitik/kelas`) and R1-AS-5 (same page, school scope)
| Field | Type/Req/Default | Options | SRS |
|---|---|---|---|
| Kelas | select, "Semua Kelas" | OPT-KELAS-OWN | C |
| Mata Pelajaran | select, "Semua Subjek" | OPT-SUBJEK | C |
| Risiko | select, "Semua Risiko" | OPT-RISIKO | C |
- Filters auto-submit on change (query string). Table "Senarai Pelajar" columns # · Pelajar · Ketepatan · Soalan · Trend · Unjuran · Risiko · Tindakan ("Lihat Analitik" -> `/prestasi/:userId`; for Kritikal/Tinggi also "Rekod Intervensi" -> Kirkpatrick Intervensi with the pupil preselected). Sort accuracy ascending, "Belum Bermula" last; 25 per page. Empty "Tiada pelajar sepadan dengan tapisan ini." Calculations per SRS (C): Purata Ketepatan pooled; Trend: last 7 days vs previous 7, delta > 3 points "Meningkat berbanding minggu lepas", < −3 "Menurun berbanding minggu lepas", only this week "BARU", else "Stabil".

## R1-GUR-6 Analisa Item (`/analisa-item/kelas`, `/guru/analisis-item`)
| Field | Type/Req/Default | Options | SRS |
|---|---|---|---|
| Class cards | list | OPT-KELAS-OWN; empty "Anda belum mempunyai kelas. Cipta kelas dahulu di Kelas Saya." | C |
| Mata Pelajaran | select, "Semua Subjek" | OPT-SUBJEK A-Z | C |
| Tahap Kesukaran | select, "Semua Tahap" | OPT-KESUKARAN-ITEM | P |
- Table columns # · Soalan · Subjek · Cubaan · Betul · Salah · % Betul · Diskriminasi; default sort Cubaan descending; 25 per page; empty "Tiada data cubaan lagi — analisis item akan muncul selepas pelajar anda menjawab soalan."
- Diskriminasi (SRS 535 gives D = p(upper 27%) − p(lower 27%) and the 10-pupil minimum is "[PROPOSED minimum, F-25]"; no code formula found, so the formula stays [PROPOSED] in its exact form): among the pupils in scope who answered THIS question, rank by their total accuracy on all answers in scope; group size g = max(1, ceil(0.27 × N)) where N = pupils who answered this question; U = top g, L = bottom g (ties broken by pupil id ascending); D = round((correct in U − correct in L) ÷ g, 2) where "correct" is the number of pupils in the group whose first-in-scope attempt on this question was correct. N < 10 shows "Data Tidak Mencukupi" (tab: "Data Tidak Mencukupi" / "Perlu sekurang-kurangnya 10 pelajar dengan sesi latihan selesai untuk mengira indeks diskriminasi."; table cell: "Data Tidak Mencukupi"). Status chips (SRS 533): D >= 0.40 "Sangat Baik"; 0.30 to 0.39 "Baik"; 0.20 to 0.29 "Sederhana"; < 0.20 "Lemah" (table legend "Diskriminasi: >0.3 = baik, <0 = semak semula" stays on `/guru/analisis-item`). Class page extras (SRS 533, previously omitted): search "Cari soalan...", sort select default "Paling Sukar Dahulu" with options "Paling Sukar Dahulu", "Paling Mudah Dahulu", "Ketepatan Rendah Dahulu", "Ketepatan Tinggi Dahulu", "Paling Banyak Percubaan"; tabs "Indeks Kesukaran" (default) and "Indeks Diskriminasi"; difficulty index = 1 − p to 2 decimals; "Tukar Kelas" chips = OPT-KELAS-OWN.

## R1-GUR-10 Monitoring (`/guru/monitoring`, school detail)
| Field | Type | Options | SRS |
|---|---|---|---|
| Senarai Guru pills | filter pills, default "Semua ({n})" | "Semua ({n})", "Pernah Login ({n})" (last_login not null), "Belum Login ({n})" | C |
| Drill pupil list pills + "Cari nama pelajar..." | pills, text | "Semua (n)", "● Aktif (n)", "Login sahaja", "Belum login" | P |
- Pupil table sort name ascending, 25 per page; Tahap pill bands Cemerlang > 60, Sederhana 20 to 60, Rendah > 0 and < 20, Tiada 0 over Pernah Aktif ÷ Pelajar × 100 (whole %). Empty pupil table: "Belum ada pelajar aktif di sekolah ini."; empty teacher table: "Belum ada guru berdaftar di sekolah ini." No auto-refresh.

## R1-GUR-11 Kirkpatrick (7 pages) and R1-AS-11
| Field | Type/Req/Default | Options | Validation | SRS |
|---|---|---|---|---|
| Intervensi: Pelajar | select, required, "— Pilih pelajar —" | own pupils sorted Kritikal/Tinggi first then name; preselect from query `pelajarId` | "Sila pilih pelajar." | P |
| Jenis | select, required, "-- Pilih jenis --" | OPT-JENIS-INTERVENSI | "Sila pilih jenis." | P |
| Catatan amaran (pilihan) | text, placeholder "cth: ketepatan menurun 3 minggu" | max 300 | "Catatan tidak boleh melebihi 300 aksara." | P |
| Tindakan diambil | textarea, required, placeholder "cth: sesi bimbingan 1-1, hubungi penjaga" | max 500 | "Sila isi tindakan diambil."; max "Tindakan diambil tidak boleh melebihi 500 aksara." | P |
| Rekod Intervensi | button "✓ Rekod Intervensi" | success "Intervensi direkodkan." | | C |
- No page filters for Guru. AS-11 (SRS read): the filter card is a LOCKED read-only label "{nama sekolah}" with the line "{kod} · {PPD} · {negeri}" and no select (no "Sekolah", no "Negeri", FR-AS-11-2); the only button on the card is none (V2 "Tapis" is removed with the selects). Tabs "Ringkasan", "Tahap 1: Reaksi", "Tahap 2: Pembelajaran", "Tahap 3: Tingkah Laku", "Tahap 4: Hasil", "Rantaian Impak", "Intervensi"; the comparison panel "Perbandingan Sebelum & Selepas" compares the first month with data to the latest month with data (no input), "Data tidak mencukupi untuk perbandingan." otherwise; button "Muat Turun Laporan" on Rantaian Impak (PDF); Tahap 2 "Prestasi Mengikut Subjek" status "Mastered" when accuracy >= 80 else "Developing" (V2 English words kept); Tahap 1 sections "Butiran Maklum Balas", "Taburan Mood", "Komen Terkini" (table Komen · NPS · Kepuasan · Tarikh, newest first, 10 rows); Intervensi for AS: reads all interventions of the school, form as Guru with Pelajar = active pupils of the school (sort name), and `student_id` of another school refused with 404.
- Intervention state: `Menunggu Semakan` (created) -> reviewed when "Semak keputusan" is pressed after >= 7 days [PROPOSED] and shows "Ketepatan Sebelum {a}% → Selepas {b}%" (a = pupil accuracy in the 14 days before the record, b = 14 days after, whole %); "Meningkat" counter = reviewed interventions with b > a.
- Engagement bands OPT-ENGAGEMENT. Learning Gain g = (Post − Pre) ÷ (100 − Pre) with Pre = accuracy of the first week of data and Post = accuracy of the last 7 days, both as fractions, 2 decimals; High g >= 0.7, Medium 0.3 <= g < 0.7, Low g < 0.3; needs >= 14 days between first and last answer else "-". Korelasi (r) = Pearson over pupils (x = answers count, y = accuracy %), 2 decimals; "Kekuatan": |r| >= 0.7 "Kuat", 0.4 to < 0.7 "Sederhana", 0.1 to < 0.4 "Lemah", < 0.1 "Tiada"; fewer than 5 pupils with answers: "Tiada data". Correlation table bands "1-20 soalan", "21-50 soalan", "51-100 soalan", "100+ soalan" (each pupil in exactly one band) with pupils and mean accuracy. ROI and GPS are "—" without imported data. PDF export `/export-pdf`: the Ringkasan cards and the seven-tab tables in tab order, filename `kirkpatrick-{kelas|sekolah}-{yyyymmdd}.pdf`.

## R1-GUR-42 Laporan (`/guru/laporan`)
| Field | Type/Req/Default | Options | SRS |
|---|---|---|---|
| Kelas | select, "Semua Kelas" | OPT-KELAS-OWN | C |
| Range | pills, "30 Hari" | OPT-JULAT | C |
- Class and range both survive change of either (query `classroomId`, `range`). "Paling Aktif": top 10 by sessions (ties by name). Trend: one bar per day, label `dd/mm`. Formulas per SRS (C). Lists: "Pelajar Belum Pernah Login ({n})", "Pelajar Belum Pernah Buat Latihan ({n})": name ascending, first 10 with "+ {n} lagi" link expanding to all.

## R1-GUR-43 Laporan Mingguan (`/guru/laporan-mingguan-kelas`)
| Field | Type/Req/Default | Options | SRS |
|---|---|---|---|
| Pilih Kelas | select, default first class | OPT-KELAS-OWN with no "all" option; no class: "Tiada kelas lagi" | C |
| Cetak | button | prints per GLB-6; title "Laporan Mingguan — {kelas} | {dd Mon} – {dd Mon yyyy}"; with no class "Laporan Mingguan — Semua Kelas | ..." | C |
- Week fixed to the current Monday-Sunday (API param `week=YYYY-MM-DD` for tests only, no UI). Accuracy 1 decimal in this report. Top Performers: >= 5 answers, accuracy descending, ties by answers descending then name, 5 rows. Paling Meningkat: delta > 0, delta descending, ties by name, 5 rows; shows "{from}% → {to}%" and "+{delta}%". Subjek Perlu Perhatian: weekly subject accuracy < 50, ascending. Empty copies exactly as SRS (C), plus "Syabas! Semua subjek melebihi 50% ketepatan."

## R1-GUR-44 Sumbang Soalan (`/guru/soalan`, `/cipta`, `/:id`, `/:id/edit`)
APIs: API-GUR-17/18/19/20. DM: `questions` (+ `source='guru'`, status), `intake_batches`.
### 44-F1 Bank contribution form "Tambah Soalan" (title "Tambah Soalan Baru"; also edit)
| Field | Type/Req/Default | Options / source | Validation + error | Depends | SRS |
|---|---|---|---|---|---|
| Tingkatan * | select, required | OPT-TINGKATAN, "-- Pilih tingkatan --" | "Sila pilih tingkatan." | - | P |
| Subjek * | select, required | OPT-SUBJEK, "-- Pilih subjek --" | "Sila pilih subjek." | - | P |
| Bab * | select, required, "-- Pilih bab --" | `GET /api/guru/chapters?subjectId&levelId`, label "{nombor}. {nama}" ordered by number; empty list text in the control "Tiada bab untuk subjek dan tingkatan ini." | "Sila pilih bab." | Subjek + Tingkatan | P |
| SP * | select, required, "-- Pilih SP --" | `GET /api/guru/dskp/sp?bidangId/skId` (API-DSKP-07) limited to the chosen Bab, label "{kod} {nama}" | "Sila pilih Standard Pembelajaran (SP)." | Bab | P |
| TP * | select | OPT-TP | "Tahap Penguasaan (TP) mesti antara 1 dan 6." / "Sila pilih TP." | - | C |
| Aras Pemikiran * | select | OPT-ARAS | "Sila pilih aras pemikiran." | - | M |
| Kesukaran * | select | OPT-KESUKARAN | "Sila pilih kesukaran." | - | P |
| Soalan * | textarea | max 2000 | "Sila isi soalan."; "Soalan tidak boleh melebihi 2000 aksara." | - | P |
| Pilihan A, B, C, D * | 4 text inputs, each with a radio | max 500 each | "Sila isi pilihan {A/B/C/D}." | - | P |
| Jawapan betul | radio (A/B/C/D), exactly one, none preselected on create; on edit the stored one | | "Sila tanda satu jawapan yang betul." | - | P |
| Penerangan (Pilihan) | textarea | max 2000 | max message GLB-1 | - | P |
- Buttons "Batal", "Hantar untuk Semakan". Removed from V1: "Topik (Pilihan)" and "Jenis Soalan" (R1 teacher form is MCQ only). Success: "Soalan dihantar untuk semakan." status `review`.
- State machine: `review` ("Menunggu Semakan") -> `approved` ("Diluluskan") by Admin Pusat accept; `review` -> `draft` ("Ditolak") by admin with a reason (shown on the card as "Sebab: {reason}"); teacher may edit or delete only `review` and `draft`; editing a `draft` and pressing "Hantar untuk Semakan" returns it to `review`; `approved` is read-only for the teacher (no edit/delete; buttons absent). Side effects: stat cards "Jumlah" (all own), "Diluluskan", "Menunggu" (`review`), "Digunakan" (approved questions answered >= 1 time in any mode); badge tiers use "Jumlah"; Dashboard "Soalan" = same total.
### 44-F2 Soalan Saya list
Own questions only, 20 per page, newest first; expandable card: text excerpt (120 chars), chip OPT-STATUS-SOALAN, options with the correct one marked, "Penjelasan", "#{id}", buttons "Edit", "Padam" (CF-02), the last two only for `review`/`draft`. Empty: "Belum ada soalan dihantar" / "Klik \"Tambah Soalan\" untuk mula menyumbang!" / "Tambah Soalan Pertama". "Pecahan Subjek" chips: subject name with count, sorted count descending, ties by name.
### 44-F3 Import Soalan (CSV/Excel)
| Field | Spec |
|---|---|
| Pilih Fail CSV | file, required, `.csv` only (the "Excel" in the title is not supported in R1; an `.xlsx` is rejected), max 2 MB, UTF-8; errors "Fail mesti berformat CSV." / "Saiz fail melebihi 2 MB." / "Pilih fail dahulu." |
| Template | button, downloads `templat-soalan.csv`: header row `subjek,tingkatan,bab,sp,tp,aras,kesukaran,soalan,pilihan_a,pilihan_b,pilihan_c,pilihan_d,jawapan,penerangan` plus one example row with fictitious text (`Matematik,4,Bab 1,1.1.1,3,mengaplikasi,3,Contoh soalan?,A,B,C,D,A,Contoh penerangan`) |
| Row rules | `subjek` = BM subject name from OPT-SUBJEK; `tingkatan` 1..5; `tp` 1..6; `aras` = stored value of OPT-ARAS; `kesukaran` 1..5; `jawapan` one of A,B,C,D (case-insensitive); max 500 data rows (more: whole file refused "Fail melebihi 500 baris."). Missing bab/sp/tp/aras is accepted (admin completes in review). |
| Result | message "{a} soalan diimport, {b} baris gagal." and a table Baris · Sebab; reasons: "Subjek tidak dikenali.", "Tingkatan mesti antara 1 dan 5.", "Tahap Penguasaan (TP) mesti antara 1 dan 6.", "Aras pemikiran tidak sah.", "Kesukaran mesti antara 1 dan 5.", "Jawapan mesti A, B, C atau D.", "Soalan diperlukan.", "Pilihan {A/B/C/D} diperlukan."; valid rows are created as `review`; the failed rows can be downloaded as `ralat-import-{yyyymmdd}.csv` (columns Baris, Sebab, then the original columns) |
### 44-F4 Hantar Kertas Soalan kepada Admin
| Field | Type/Req/Default | Options | Validation + error | SRS |
|---|---|---|---|---|
| Jenis Soalan * | select, "-- Pilih Jenis --" | OPT-KERTAS | "Sila pilih jenis soalan." | P |
| Matapelajaran * | text (free text by design: the admin classifies) | max 100 | "Sila isi matapelajaran." | P |
| Tingkatan | select, "-- Semua / Tidak Pasti --" | OPT-TINGKATAN | none | C |
| Tahun | integer, optional, empty | 2000..2099 | "Tahun mesti antara 2000 dan 2099." | P |
| Disediakan Oleh | text, optional, empty | max 150 | max message | P |
| Catatan Tambahan | textarea, optional | max 1000 | max message | P |
| Fail Soalan + Skema * | file picker, multiple, required | `.pdf`, `.docx`, `.xlsx`; 1..5 files; each <= 20 MB | "Pilih sekurang-kurangnya satu fail."; "Maksimum 5 fail sahaja."; "Saiz setiap fail mesti tidak melebihi 20MB."; "Format fail tidak diterima. Gunakan PDF (teks), DOCX atau XLSX."; scanned PDF (no extractable text on the first 3 pages, checked server side) "PDF imbasan imej tidak diterima — teks mesti boleh disalin." | P |
- Skema jawapan is required by the written rule but cannot be machine-checked: the form has a checkbox "Saya sahkan skema jawapan disertakan bersama soalan." (required; "Sila sahkan skema jawapan disertakan.") [PROPOSED]. Any invalid file rejects the whole submission (nothing stored). Success "Kertas dihantar kepada admin."; a batch with `source='guru'` appears in Admin Pusat Import & Semakan "Kiriman Guru". Teacher sees no list of submissions in R1 (V2 has none).
- Badges "Pencapaian Badge Penyumbang": eight tiers as SRS; "Sasaran seterusnya: {tier} — {n} soalan" where n = threshold − Jumlah; at the last tier "Tahap tertinggi dicapai".

## R1-GUR-44a Soalan & Rujukan (`/guru/soalan-guru`, `/cipta`)
DM: `questions` with `visibility='teacher_private'`, `owner_teacher_id`, `reference_url` [PROPOSED columns]; API `GET/POST/PUT/DELETE /api/guru/private-questions` [PROPOSED name].
Fields: same as 44-F1 except: **Tahap** is the Tingkatan field (RESOLVED: Tingkatan is REQUIRED, per the DSKP principle; the form select is "Tahap *" with placeholder "-- Pilih tahap --" and Tingkatan 1-5 only, empty fails with "Sila pilih tingkatan."; the text "-- Semua tahap --" exists ONLY as the first option of the list filter on `/guru/soalan-guru`, never in the form); add **Pautan Rujukan (pilihan)** (url, optional, max 500; must start with `http://` or `https://`, error "Pautan mesti bermula dengan http:// atau https://."; help "Video YouTube, Anyflip, PDF atau apa-apa link rujukan."). Labels "Subjek *", "Kesukaran *", "Teks Soalan *", "Pilihan Jawapan * (pilih jawapan betul)" (help "Butang radio menandakan jawapan yang betul."). Buttons "Batal", "Simpan Soalan". Success "Soalan disimpan." No admin review, no status chip; list columns Teks (120 chars), Subjek, Tahap, Kesukaran (stars), Rujukan (link icon if set), actions "Edit", "Padam" (CF-02). Empty: "Belum ada soalan peribadi." / "Tambah Soalan". A question used by an active Misi cannot be deleted: "Soalan sedang digunakan dalam misi." List: own only, newest first, 20 per page.

## R1-GUR-44b Soalan Berstruktur (`/guru/soalan-berstruktur`)
| Field | Type/Req/Default | Options | SRS |
|---|---|---|---|
| Subjek | select, "Semua" | OPT-SUBJEK A-Z | P |
| Tingkatan | select, "Semua" | OPT-TINGKATAN | C |
| Status | select, "Semua" | "Semua", "Diluluskan"->`approved` (teacher also sees own `review` under "Menunggu Semakan"->`review` [PROPOSED]) | C |
| Tapis | button | page 1, filter in query | C |
- Table as SRS; 20 per page newest first; sub-line "Cipta & urus soalan berstruktur mengikut piawaian SPM KPM — {n} soalan dalam bank". Empty: "Tiada soalan berstruktur dijumpai."
- Teacher submission form (SRS:M; route `/guru/soalan-berstruktur/cipta`, button "Cipta Soalan Berstruktur", edit `/:id/edit` for own `review`/`draft`). Fields: Tingkatan * (OPT-TINGKATAN), Subjek * (OPT-SUBJEK), Bab *, SP *, TP * (OPT-TP), Aras Pemikiran * (OPT-ARAS), same rules as 44-F1; "Rangsangan" (textarea, optional, max 4000; "Rangsangan tidak boleh melebihi 4000 aksara."; image upload `question_image`: jpg/png/webp, <= 5 MB, "Fail mesti berupa imej (jpg, png atau webp)." / "Saiz imej tidak boleh melebihi 5 MB."); repeatable "Sub-Soalan" 1..10: "Teks sub-soalan *" (max 2000, "Sila isi teks sub-soalan."), "Markah *" (integer 1..20, "Markah mesti antara 1 dan 20."), "Skema Jawapan *" (textarea max 2000, "Sila isi skema jawapan."), "Aras Pemikiran" per part (OPT-ARAS, default the question's); "Tambah Sub-Soalan" / "Buang" (min 1; "Sekurang-kurangnya satu sub-soalan diperlukan."). Total marks = sum of parts shown "Jumlah markah: {n}". Submit "Hantar untuk Semakan" creates an intake batch `source='guru'`, status `review`; same state machine as 44-F1. Success "Soalan berstruktur dihantar untuk semakan." Kesukaran (OPT-KESUKARAN) is also required.

## R1-GUR-44c Soalan Gambar Rajah (`/admin/soalan-gambar`)
| Field | Spec | SRS |
|---|---|---|
| Mata Pelajaran | select, "Semua Mata Pelajaran", OPT-SUBJEK A-Z limited to subjects having listed questions | P |
| Semua Sekolah | HIDDEN for Guru and Admin Sekolah (scope is own school) | M |
| Tapis | button | C |
| Upload per card | file, jpg/png/webp, <= 5 MB, errors "Fail mesti berupa imej (jpg, png atau webp)." / "Saiz imej tidak boleh melebihi 5 MB."; success "Gambar dihantar untuk semakan."; the card keeps listing with chip "Menunggu Semakan" until an admin accepts | P |
- No "Dismiss" for teachers. Empty "Semua soalan sudah lengkap dengan gambar rajah!". Counts computed from dataset; nav badge = "MCQ Perlu Gambar".

## R1-GUR-44d Databank Soalan (`/guru/databank`)
| Field | Spec | SRS |
|---|---|---|
| Subject tiles | toggle; selecting highlights and filters the list, selecting again clears; "Subjek Teras (7)" = Bahasa Melayu, Bahasa Inggeris, Matematik, Sains, Sejarah, Pendidikan Islam, Pendidikan Moral; "Subjek Elektif (n)" the rest; tile = BM name + English name + "{n} soalan" ("0 soalan" kept); English names (seed constant): Malay Language, English Language, Mathematics, Science, History, Islamic Education, Moral Education, Additional Mathematics, Physics, Chemistry, Biology, Geography, Visual Arts Education, Music Education, Physical and Health Education, Design and Technology, Computer Science, Arabic Language, Chinese Language, Tamil Language, Principles of Accounting, Economics, Business, Al-Quran and As-Sunnah Education, Islamic Tasawwur, Jawi, Islamic Syariah Education, Home Science, Women's Garment Making, Agriculture, Sports Science (in OPT-SUBJEK order) | P |
| Cari + "Cari" | text, placeholder "Cari teks soalan...", Enter or button, GLB-4 search | P |
- Table "Senarai Soalan" columns # (question id), Soalan (55 characters + "..."), Subjek, Tahap, Kesukaran (stars), Status ("Diluluskan"); 20 per page, newest first; empty "Tiada soalan sepadan dengan carian anda." Read-only.

## R1-GUR-44e Kertas Peperiksaan (`/guru/kertas-peperiksaan`)
DM: `exam_papers` with `owner_teacher_id`, `status`, `exam_paper_classrooms` [PROPOSED]; API `GET/POST/PUT/DELETE /api/guru/exam-papers`, `POST /:id/share {classroomIds}`, `POST /:id/withdraw` [PROPOSED].
| Field | Type/Req | Options | Validation | SRS |
|---|---|---|---|---|
| Nama Kertas | text, required, placeholder "cth: Ujian Pertengahan Tahun" | max 150 | "Sila isi nama kertas." | P |
| Subjek | select, required, "— Pilih Subjek —" | OPT-SUBJEK A-Z | "Sila pilih subjek." | P |
| Kelas (Kongsi) | multi-select checkboxes, required to share | OPT-KELAS-OWN | "Pilih sekurang-kurangnya satu kelas sebelum berkongsi." | M |
- Statuses: `draft`="Draf", `shared`="Dikongsi". "Cipta Baharu" creates `draft`, list row = name, subject, status chip, buttons "Urus", "Kongsi"/"Tarik Balik", "Padam" (CF-13). Success "Kertas dicipta.", "Kertas dikongsi.", "Kertas ditarik balik." Question picker as 8b (approved only, whole stimulus groups, max 100 questions; "Satu kertas boleh mengandungi paling banyak 100 soalan."). Empty "Belum ada kertas peperiksaan. Cipta kertas pertama anda di bawah."

## R1-GUR-A1 Profil Saya (`/guru/profil/edit`)
| Field | Type/Req/Default | Validation | SRS |
|---|---|---|---|
| Nama Penuh * | text, required, max 255 | "Sila isi nama penuh." | C |
| E-mel | read-only, help "E-mel log masuk tidak boleh ditukar di sini." | | C |
| Bio | textarea, optional, max 1000, placeholder "Ceritakan tentang diri anda sebagai pendidik..." | max message | C |
| No Kad Pengenalan | text, optional, max 20 stored; accepted exactly 12 digits, placeholder "cth: 860101015432" | "No. IC mesti 12 digit tanpa sempang." | P |
| Sekolah | combobox "Taip nama sekolah untuk cari...", min 2 chars, 20 results, empty "Tiada sekolah dijumpai" | | C |
| Subjek Utama | text, optional, max 100, placeholder "cth: Matematik, Sains" | max message | P |
| Kelayakan | text, optional, max 150, placeholder "cth: Ijazah Sarjana Pendidikan" | max message | P |
| Pengalaman (tahun) | integer, default 0 | 0..60: "Pengalaman mesti antara 0 dan 60 tahun." | C |
- "Simpan Profil" -> toast "Profil dikemaskini."; "Batal" leaves without saving; "Salin Link" turns to "Disalin!" for 2 s.

## R1-GUR-A2 Tetapan Peribadi (`/tetapan`)
"Mod Rohani" toggle (default off), "Latar Agama" select (OPT-LATAR-AGAMA, enabled only when Mod Rohani is on), "Simpan" -> toast "Tetapan disimpan." Read-only rows Telefon ("—" if empty), Sekolah, Peranan, Status ("● Aktif" / "● Tidak Aktif"). Footer replacement "Untuk menukar maklumat akaun, buka Profil Saya." (SRS C).

## R1-GUR-A4 Tiket Bantuan / R1-AS-A4
| Field | Type/Req | Validation | SRS |
|---|---|---|---|
| Subjek | text, required | max 150: "Sila isi subjek." | P |
| Butiran | textarea, required | max 2000: "Sila isi butiran." | P |
| Status tabs | OPT-STATUS-TIKET, default "Semua" | | C |
- No attachment field (FR-GUR-A4-5 mention of an attachment picker is removed). "Hantar Tiket" -> toast "Tiket dihantar." Statuses move by admin only (`open` -> `in_progress` -> `waiting_reply` -> `resolved` -> `closed`); the owner cannot reply (a new ticket is opened). Empty "Tiada tiket lagi." / "Buat Tiket Pertama". Counter "Jumlah tiket: {n}".

## R1-AS-51 Senarai Pelajar (`/admin-sekolah/pelajar`)
APIs: API-AS pupils list/export/form-options/reset + new `POST /api/admin-sekolah/pelajar/import`, `POST /api/admin-sekolah/pelajar/import/preview` [PROPOSED]. DM: `users`, `enrolments`, `school_subscriptions.student_quota`.
| Field | Type/Req/Default | Options / source | Validation | SRS |
|---|---|---|---|---|
| Cari | text, placeholder "Cari nama, e-mel atau nama pengguna..." | substring on name, e-mail, username | min 2 chars | C |
| Status | select, "Semua" | OPT-STATUS-AKAUN | | C |
| Tingkatan | select, "Semua Tingkatan" | OPT-TINGKATAN | | M |
| Kelas | select, "Semua Kelas" | classes of the school; when Tingkatan is chosen only classes of that Tingkatan; label name; sort Tingkatan then name | | M |
| Tapis | button | | | C |
- List 25 per page, active first then newest; columns # · Nama (username beneath) · Emel · Telefon · Sekolah · Aktif · Tarikh (`dd/mm/yyyy`) · Tindakan ("Sunting", "Reset Kata Laluan", "Pratonton" for active pupils); counters "{n} pelajar" and "{n} aktif". Empty "Tiada pelajar dijumpai."
- Edit/Add form fields: "Nama penuh *" (max 255, "Sila isi nama penuh."), "Nama pengguna *" (3..30 chars, `^[a-z0-9._-]+$`, unique within the school; help text as SRS; errors "Nama pengguna mesti 3 hingga 30 aksara." / "Nama pengguna hanya boleh mengandungi huruf kecil, nombor, titik, sengkang dan garis bawah." / 409 "Nama pengguna sudah digunakan dalam sekolah ini."), "Sekolah *" locked label, "Kelas" (select of classes of the school, "-- Tiada --"; one primary class; more classes are added by teachers), "E-mel (pilihan)" ("Format e-mel tidak sah."; 409 "E-mel sudah digunakan."), "Peranan" (read-only "Pelajar", note "Hanya admin pusat boleh menukar peranan."), status radios (OPT-STATUS-AKAUN, default "Aktif (boleh log masuk)" on create... pupils created by the school admin are `active`), buttons "Simpan", "Kembali". Reset password: "Kata laluan baharu" (password, optional, min 8: "Kata laluan mesti sekurang-kurangnya 8 aksara."), blank = default password; "Tetapkan Semula" opens CF-12; the resulting password is shown once in a banner "Kata laluan baharu: {kata laluan}. Salin sekarang — tidak dipaparkan lagi." Success toasts "Pelajar disimpan.", "Kata laluan ditetapkan semula."
- Import (button "Import Pelajar", page `/admin-sekolah/pelajar/import`): "Tingkatan" select ("— Pilihan —", OPT-TINGKATAN; hint "Digunakan jika baris tidak menyatakan kelas."), file dropzone "Klik untuk pilih fail atau seret & lepas di sini" with caption ".csv atau .txt · maksimum 2 MB · lajur: nama, email, kelas". File rules: UTF-8, comma or semicolon delimiter detected from the header, first row is the header (`nama,email,kelas`, case-insensitive; `email` and `kelas` may be empty columns but the header must contain `nama`), at most 500 data rows and not more than the remaining seats. Preview: "Pratonton · semua {n} baris" shows the first 20 rows with "Ini contoh sahaja. {n} baris lagi tidak dipaparkan — kesemua {n} pelajar akan diimport." and "Tukar". Submit "Import Pelajar" (busy "Mengimport..."). Row rules: nama required ("Nama diperlukan."), e-mail valid if present ("Format e-mel tidak sah."), e-mail unique in the platform ("E-mel sudah wujud."), `kelas` must match a class of the school (case-insensitive) else uses the select; neither gives "Kelas tidak dijumpai."; a duplicate nama+kelas inside the file is allowed, a duplicate e-mail inside the file fails the later row ("E-mel berulang dalam fail."). Errors: wrong type "Fail mesti berformat CSV atau TXT."; size "Saiz fail melebihi 2 MB."; no header "Baris pertama mesti mengandungi lajur nama."; > 500 "Fail melebihi 500 baris."; quota GLB-1 (whole file refused, nothing created). Outcome: valid rows are created (`inactive`, pending Admin Pusat) even when others fail; result panel "{a} pelajar berjaya diimport, {b} baris gagal." + "Pelajar yang diimport menunggu kelulusan Admin Pusat." + table Baris · Nama · Sebab + button "Muat Turun Ralat" (`ralat-import-pelajar-{yyyymmdd}.csv`, columns Baris, Sebab, nama, email, kelas). "Muat Turun CSV Pelajar" template: `templat-pelajar.csv` with header `nama,email,kelas` and one fictitious row `Murid Contoh,murid.contoh@example.org,5 Bestari`. "Tutorial" opens `/panduan?peranan=admin-sekolah`.
- Remaining seats = `student_quota` − pupils of the school (active + pending). Eksport CSV: filtered list, filename `pelajar-{yyyymmdd}.csv`, columns "Bil","Nama","Nama Pengguna","Emel","Telefon","Tingkatan","Kelas","Status","Tarikh Daftar".
- Account state machine: created by import -> `pending` (inactive) -> `active` by Admin Pusat approval; created by the school admin form -> `active`; `active` <-> `suspended` by the school admin ("Digantung", pupils only); suspended pupil cannot log in ("Akaun anda digantung. Sila hubungi pentadbir sekolah."). Another school's pupil = 404.

## R1-AS-52 Senarai Guru (`/admin-sekolah/guru`)
| Field | Type/Req/Default | Options | SRS |
|---|---|---|---|
| Cari | text, placeholder "Cari nama atau e-mel..." | | P |
| Status | select, "Semua" | OPT-STATUS-AKAUN | P |
| Cipta Pengguna form: Nama penuh * (255), E-mel * (login, valid, unique: "Sila isi e-mel."/"Format e-mel tidak sah."/"E-mel sudah digunakan."), Subjek Utama (100), Kelayakan (150), No. IC (optional, 12 digits), Kata laluan baharu (optional, min 8, blank = default password), Peranan read-only "Guru" | as listed | | M |
- Columns # · Nama · Emel · Subjek Utama · Kelas (count) · Status · Login Terakhir (`dd/mm/yyyy HH:mm` or "Belum login"); 25 per page, name ascending. Teacher created by the school admin is `active`; pending list "Guru Menunggu" has "Sahkan" (approve) per row; deactivate via the existing API (`POST .../toggle-active`) with the OQ-AS-12 rule. Export `guru-{yyyymmdd}.csv` columns "Bil","Nama","Emel","Subjek Utama","Bilangan Kelas","Status","Login Terakhir". No import. Empty "Tiada guru berdaftar untuk sekolah ini."

## R1-AS-53 Kelas Sekolah
Search "Cari kelas..." (substring on class name), "Tingkatan" select ("Semua Tingkatan", OPT-TINGKATAN); table # · Kelas · Subjek · Tingkatan · Guru · Murid; sort Tingkatan then name; counter "{n} Kelas Aktif"; empty "Tiada kelas dijumpai."

## AS report screens (all SRS sections read; see also Part 5 for AS-1, 4, 6, 7, 45, 46-50, Delivery B)
- **AS-10 Monitoring:** "Tempoh" (OPT-TEMPOH-AS) and buttons "Tapis" and "Reset" (resets to "Semua Masa"); "Negeri" hidden (SC-AS). Tables 25 per page, order by % descending.
- **AS-46 Statistik Penggunaan:** pills OPT-TEMPOH-AS second form; empty "Tiada data untuk tempoh ini".
- **AS-47 DSKP Heatmap:** "Subjek" (OPT-SUBJEK limited to subjects with content, default the first such subject), "Tingkatan" (OPT-TINGKATAN limited to Tingkatan with content, default the highest with content); legend OPT-HEATBAND (one line); cell = round(correct ÷ answered × 100) of the school's pupils on questions mapped to the SP; tooltip "{kod SP}: {tajuk} — {band} ({n} jawapan)".
- **AS-48 Laporan Aktiviti:** pills OPT-JULAT, tabs "Overview" (default), "Guru", "Murid"; list tabs 25 per page, name ascending; "Pecahan Aktiviti" labels "SPM Tahun Lepas", "Ulang Kaji", "SPM Mock", "Tracking A", "Latih Tubi", "Battle", "Permainan".
- **AS-49 Amaran Awal:** level pills "Semua Tingkatan" (default) + one pill per Tingkatan with pupils ("Tingkatan n"); score = 0.4·A + 0.3·E + 0.3·M, Hijau < 40, Kuning 40 to 59.9, Merah >= 60 (rounded to 1 decimal); "Belum Bermula" excluded from the three groups; CSV `amaran-sekolah-{id}-{yyyymmdd}.csv` columns "Bil","Pelajar","Sekolah","Tingkatan / Kelas","Skor Risiko","Status","Ketepatan","Penglibatan","Penguasaan"; list sort score descending, 25 per page.
- **AS-50 Laporan Bulanan:** "Bulan" select (OPT-BULAN, default the previous full calendar month) and "Tahun" select (current year and the two before, default current year); API `month=YYYY-MM`; buttons "Cetak" (A4, title "Laporan Bulanan — {Bulan} {tahun}"). Months with no data show the cards with "—" and the empty copy "Tiada data untuk bulan ini."

---

# PART 4 - COUNTS AND TOP GAPS

SRS status counts (per field rows of Part 3 as originally found in the SRS, before this spec): COMPLETE about 38, PARTIAL about 96, MISSING about 20 (of which MISSING-NO-SOURCE, fully [PROPOSED]: teacher structured-question form, Aras labels (labels only; enum from contract), Pelajar Terbaik list, RS (SPM Sebenar) entry, Diskriminasi formula, correlation strength labels, Latar Agama values, AS-52 teacher form). Behaviour items (a-h, 8 areas, about 61 sub-items): COMPLETE about 16, PARTIAL about 36, MISSING about 9. After this document every PARTIAL/MISSING row has a buildable spec; items still needing a user or code check are only: option values of the existing V3 "Latar Agama", Prisma column names for [PROPOSED] tables, and the unread SRS sections listed in section 0.

Top gaps that would have made a developer guess: (1) teacher structured-question submission form had no fields; (2) Aras Pemikiran had no value list (now the contract Bloom enum); (3) 44a "Tahap" optional versus required Tingkatan; (4) Bab/SP dependent selects; (5) about 35 validation messages described but not quoted; (6) Set Soalan class multi-select label and refusal text; (7) CSV import columns, size, row cap and row errors for questions and pupils; (8) Hantar Kertas file errors and the unverifiable "skema wajib"; (9) error matrix 401/409/429/5xx/network/timeout and the 403 versus 404 inconsistency; (10) engagement bands overlapping at 5/20/50; (11) Diskriminasi formula; (12) Kirkpatrick correlation, Learning Gain minimums and PDF content; (13) AS-52 teacher form; (14) AS-51 class/Tingkatan filter; (15) class form limits and username/IC rules; (16) Headcount card/Auto-Setup messages and RS (SPM Sebenar) entry; (17) Pelajar Saya V2 column definitions; (18) status machines for rejected question, published-set edit lock, kertas, intervention; (19) AS-50 period selector, AS-10 Negeri filter, Gambar Rajah "Semua Sekolah"; (20) confirm dialogs without text (Misi, Keluarkan, Scan, Gugurkan).

(Part 4 above was written before the second pass. PART 5 corrects names and values; PART 6 replaces the counts and the gap list.)

---

# PART 5 - RECONCILIATION WITH PRISMA, 50 AND 60, AND THE SCREENS ADDED IN THE SECOND PASS

## 5.1 Real names replacing the [PROPOSED] names of Part 3 (source: `apps/api/prisma/schema/*.prisma`, `50-data-model-erd.md`, `60-api-contract.md`)

| Topic | Part 3 said | Real name / rule | If the field does not exist |
|---|---|---|---|
| Role values (OPT-ROLE) | `users.role` | table `user_roles.role`; values `student`, `teacher`, `school_admin`, `ppd_officer`, `admin` (60 API-RPT-06 role list) | none |
| Tingkatan stored (OPT-TINGKATAN) | grade 1..5 | `classrooms.education_level_id` (FK `education_levels`, whose `grade` is 1..5); users keep `users.grade` smallint and `users.class_label`; question side `question_versions` level FK; API field `educationLevelId` | none |
| Class | `classrooms` | `classrooms`: `kind`, `name`, `teacher_id`, `school_id`, `subject_id` (nullable = "— Tiada —"), `education_level_id`, `academic_year smallint` (= Tahun Sesi), `is_active`, `join_code` (to be hidden, FR-GUR-8) | uniqueness of Nama Kelas is NOT in the schema: needs a new DM (ID to be allocated in 50 section 4.4): unique index `(teacher_id, academic_year, lower(name))` where `kind='classroom'`; duplicate -> 409 "Nama kelas sudah digunakan." |
| Enrolment | `enrolments` | `enrolments.status` `active`/`removed`, `source` `code`/`teacher`/`school_admin`/`complimentary`; add by teacher writes `source='teacher'`, add by school admin `school_admin`; "Keluarkan" sets `removed` | none |
| Pupil account status (OPT-STATUS-AKAUN) | invented | `users.is_active` + `users.is_suspended`: `active` = is_active and not suspended; `inactive` = not is_active (imported, awaiting Admin Pusat); `suspended` ("Digantung") = is_suspended; pending teacher = `users.pending_school_id` set | none |
| IC | plain 12 digits | accepted as 12 digits, stored only as `users.ic_hash` (keyed HMAC) and `users.ic_masked`; duplicate check on `ic_hash`; never returned in full | none |
| Username | unique per school | `users.username` exists; uniqueness within the school is not enforced by the schema in what was read | needs a DM (ID to allocate): unique `(school_id, lower(username))` where username is not null |
| Teacher profile (A1) | `teacher_profiles` | `teacher_profiles.subject`, `qualification`, `experience_years smallint`; `users.bio`, `users.phone`; API-GUR-22 `PUT /api/account/teacher-profile` takes {bio, subjects[], phone?}: `subjects[]` vs the single text "Subjek Utama" and the missing `qualification`, `experienceYears`, `icNumber`, `schoolId` in that body must be added | API-GUR-22 body amended: {name, bio, ic?, schoolId, subject, qualification, experienceYears} |
| Misi Harian (GUR-2b) | `daily_missions`, `targetQuestions`, `rewardCoins` | table `missions` exists but models a DIFFERENT mission (`mission_type` latih_tubi/tracking_a/youtube, `subject_id` NOT NULL, `question_count`, `coins_per_correct`, `mission_date`, `classroom_id`); the V2 form needs `description`, a reward per mission and no subject | needs a DM (ID to allocate in 50 section 4.6): on `missions` add `description text null`, `reward_coins smallint null` (0..10000), `scope text not null default 'teacher'` (`teacher`/`global`), allow `mission_type='harian'`, make `subject_id` nullable; "Sasaran Soalan" maps to `question_count` (1..1000); "Tarikh" to `mission_date`; "Kelas" to `classroom_id` (null = all own classes -> items for all own pupils); pupil recipients in `mission_items`; completed count derived from `practice_sessions.mission_id`. API-GUR-11 body `{title, description?, targetQuestions, rewardCoins, date, classroomId?}` stays. |
| Set Soalan (GUR-8b) | `question_sets` + class link | `question_sets`: `teacher_id`, `classroom_id` (single, nullable only for migrated), `subject_id`, `title`, `description`, `time_limit_minutes`, `max_attempts`, `status` `draft`/`scheduled`/`published`, `needs_rebuild`; DM-46 adds `question_set_classrooms(question_set_id, classroom_id, assigned_by, assigned_at)` (multi-class, replaces the single `classroom_id` for new sets); DM-43 adds `question_sets.kind` `set`/`kertas`; items in `question_set_items(position, question_id, question_version_no)` | "Tingkatan (pilihan)" has no column: needs a DM (ID to allocate): `question_sets.education_level_id bigint null`. `scheduled` is never produced by this UI (only Draf/Diterbitkan). `max_attempts` default 1 and `time_limit_minutes` null are not on the form (no field added). API: API-GUR-16 (`GET/POST /api/guru/question-sets`, `GET/PUT/DELETE /:id`, `POST /:id/status`, `POST /:id/copy`) |
| Headcount config / entry | `headcount_subject_defaults`, `PUT subject-defaults` (withdrawn) | `headcount_configs` (`teacher_id`, `classroom_id`, `subject_id`, `education_level_id`, `academic_year`, `active_otrs` 2..5, `mode` auto/manual, unique `(classroom_id, subject_id, academic_year, mode)`); `headcount_entries` (`tov`, `etr`, `rs`, `rs_recorded_at`, `dropped`, unique `(config_id, student_id)`); OTR/AR rows in `headcount_entry_marks`; DM-49 adds `headcount_configs.default_tov`, `default_etr numeric(4,1)` written by API-RPT-16 `PUT /api/headcounts/:id/defaults {defaultTov, defaultEtr}`. | "Simpan Sasaran" on a subject card calls API-RPT-16 once for EVERY config of that subject and year owned by the teacher (RS = `default_etr`). "RS (SPM Sebenar)" = `headcount_entries.rs`, date = `rs_recorded_at` (set when `rs` is saved, API-RPT-10 `PUT /api/headcounts/:id/tov` also carries `rs`). Key-in AR = API-RPT-10 `PUT /api/headcounts/:id/ar`; Tetapan = `PUT /api/headcounts/:id/settings`. Precision: DB `Decimal(5,2)`, UI input step 0.1 (1 decimal). |
| Intervensi (Kirkpatrick) | `OPT-JENIS-INTERVENSI` stored slugs | table `interventions`: `student_id`, `alert_type` check (`mood`, `inactive`, `declining`), `action_date`, `alert_description`, `action_taken`, `before_accuracy`, `after_accuracy`, `before_mood`, `after_mood`, `created_by_id` | mapping: "Akademik (prestasi rendah)" -> `declining`; "Kesejahteraan / mood" -> `mood`; "Kehadiran" -> `inactive`; "Lain-lain" has no value: needs a DM (ID to allocate): extend the check with `other`. "Menunggu Semakan" is derived (`after_accuracy is null`), set to reviewed when "Semak keputusan" writes `after_accuracy`; `alert_description` NOT NULL so an empty "Catatan amaran" stores an empty string; school scope via the pupil's `users.school_id` (DM-30). API-RPT-11 `GET/POST /api/kirkpatrick/interventions` |
| Questions (teacher) | `questions.difficulty` | `question_versions.difficulty_level smallint 1..5` (DM-47) and `difficulty_tp` (TP 1..6); cognitive level `cognitive_level` on the version / parts (contract `QuestionCognitiveLevel`); Bab/SP through `question_version_sp_nodes`; status events `question_status_events`; imports `question_imports`. Status words: contract status `review`/`approved`/`draft` as in OPT-STATUS-SOALAN. API-GUR-18 (create/update body `QuestionGuruCreateRequest`, must gain `difficultyLevel`, `tp`, `cognitiveLevel`, `chapterId`, `spId`) | none |
| Private question (44a) | `visibility`, `owner_teacher_id` | DM-42: `question_versions.visibility` (`bank`/`teacher_private`), `question_versions.owner_user_id`, `question_versions.reference_url` (http/https, max 2,048). API-GUR-24 `GET/POST/PUT/DELETE /api/guru/personal-questions`; mission draw API-GUR-25 | none (reference link max is 2,048, replacing my 500) |
| Teacher paper (44e) | `exam_papers` | DM-43: `question_sets.kind='kertas'`; sharing through `question_set_classrooms`; API-GUR-28 `/api/guru/kertas-peperiksaan` (+ `/:id/share`, withdraw) | none |
| Hantar Kertas (intake) | `intake_batches.paper_type` slugs, `source` | `intake_batches`: `paper_type` check `trial`/`general`/`exam`/`exercise_book`/`other`, `subject` (code `^[A-Z0-9]{2,32}$`, NOT NULL), `kertas` smallint NOT NULL (1 or 2), `year smallint` NOT NULL, `source_text` NOT NULL (max 200), `rights_status` NOT NULL, `note` (max 1000) | OPT-KERTAS mapping: "Soalan Umum"->`general`, "Trial Paper"->`trial`, "Buku Latihan"->`exercise_book`, "Soalan Peperiksaan"->`exam`, "Lain-lain"->`other`; "Soalan DSKP" and "Buku Teks" have no value: needs a DM (ID to allocate): extend the check with `dskp`, `textbook`. The teacher form has no Kertas, an optional Tahun, free-text Matapelajaran and "Disediakan Oleh": needs the same DM: `kertas` and `year` nullable, `subject` accepting free text up to 100 characters for `source='guru'`, `rights_status` defaulting to `own`, `source_text` filled from "Disediakan Oleh" (max 200; default "Kiriman guru" if empty), and a new column `intake_batches.source text not null default 'admin'` (`admin`/`guru`) because no `source` column exists (60 API-GUR-17 and the "Kiriman Guru" tab depend on it; no DM-ID found in 50). Note -> "Catatan Tambahan" (max 1000). Files: SRS accepts PDF/DOCX/XLSX; API-GUR-17 lists PDF/DOCX/images: amend API-GUR-17 to PDF, DOCX, XLSX (images not accepted) |
| Tiket | `support_tickets` | `support_tickets.subject varchar(255)`, `body`, `status` `dibuka`/`dalam_proses`/`menunggu_balas`/`selesai`/`ditutup`, `admin_reply`; DM-32 adds `created_role`, `school_id`, `admin_replied_by_id`, `admin_replied_at`. OPT-STATUS-TIKET stored values are the BM slugs, not `open`... (replaces Part 2) | Subjek max 255 (replaces 150); Butiran max 2000 [PROPOSED validation] |
| Video | category enum | `videos.category` free string, `videos.platform` (`Youtube`...), `videos.subject_id`, `videos.visibility` (default `global`), `videos.school_id`, `videos.uploader_id`, `videos.views` | category slugs stored as `motivasi`, `tutorial`, `tips_spm`, `ceramah`, `lain` [PROPOSED mapping of the five tab labels]; teacher-added video: `visibility='school'` with the teacher's `school_id` [PROPOSED] |
| Latar Agama | invented list | see OPT-LATAR-AGAMA (real values `muslim`, `hindu`, `buddhist`, `christian`, `none`) | none |
| Student import (API-AS-06) | CSV <= 2 MB, 500 rows | API-AS-06: `level` T1..T5, `csvFile` <= 1 MB, <= 1000 rows, columns nama,email,kelas, `dryRun?` (= the preview step) | CONFLICT: the V2 caption is ".csv atau .txt · maksimum 2 MB". Decision [PROPOSED]: keep the caption and amend API-AS-06 to 2 MB and 1000 rows; the earlier "500 rows" of Part 3 is replaced by 1000; the select value sent is "T1".."T5" |
| Quota | `student_quota` | `school_subscriptions.student_quota` (DM-35) | none |
| Teachers verify | - | API-AS-04 `GET /api/admin-sekolah/guru/pending`, `POST .../guru/:id/verify` | none |
| Teacher reset / toggle | - | API-AS-07 `POST /api/admin-sekolah/guru/:id/toggle-active`, `.../reset-password` | none |
| Weekly report | API param | API-GUR-21 `GET /api/guru/weekly-report?classroomId=&week=YYYY-MM-DD` | none |
| Databank / Berstruktur | - | API-GUR-27 (`/api/guru/databank/overview`, `/questions`), API-GUR-26 (`/api/guru/structured-questions`) | none |
| Pelajar Saya | - | API-GUR-05 `GET /api/guru/students?tab=mine\|school&search&page`, `PUT /api/guru/students/:id {classroomId}`, `DELETE /api/guru/students/:id?classroomId=`; API-GUR-06 `POST /api/guru/students {name, classroomId, ic?}` | none |
| Class API | - | API-GUR-01 (list), 02 (create `{name, educationLevel, subjectId?, year?}`), 03 (`PUT /api/guru/classes/:id`); join-code fields removed | none |
| Item analysis / analytics | - | API-RPT-04 (`GET /api/analytics/classes`), API-RPT-06/07 (`/api/item-analysis/school`, `/classes`, `/classes/:id`) | none |
| Monitoring | - | API-RPT-12 (`/api/monitoring/overview`, `/schools/:schoolId`, `/students/:userId`, `/teachers/:userId`; AS/G forced to own school, `state` ignored) | none |

## 5.2 Fields and behaviour of the screens read in the second pass

### R1-GUR-2 Dashboard Guru (`/guru`) - inputs and rules
- Controls: button "Tunjuk panduan mula" (reopens the guide); close "✕" on "Mula Di Sini — 3 Langkah Mudah" stores the closed state in browser storage under the key `hideGuruGuide` (per browser, per SRS 351); reopening clears it. No form fields. Links as SRS (C).
- "Tindakan Hari Ini" (FR-GUR-2-4): "Pelajar Perlu Dibantu" lists up to 5 (chip "Top 5") pupils with accuracy (XS-5, whole %) < 50 or no answer for 7+ days, ordered by accuracy ascending then inactivity days descending; counter "Pelajar" = number listed; "Topik Kritikal" up to 5 topics (sub-title "Ketepatan terendah") with accuracy < 50 and >= 10 answers, ascending; "Tindakan Disyorkan" = the one rule-based item of SRS 345 (chip "Rule-based").
- Tiles "On Track" / "Off Track": pupils with XS-5 >= 55 / < 55 among pupils with answers (captions "Ketepatan 55% atau lebih" / "Ketepatan di bawah 55%"); pupils with no answers are in neither.
- "Peer Tutor Matching" [PROPOSED rule, SRS gives none]: for each subject, pair a pupil with accuracy < 50 (>= 10 answers) with a classmate of the same class with accuracy >= 80 (>= 20 answers) in that subject; at most 3 pairs, row text "{pelajar pembimbing} boleh membantu {pelajar} dalam {subjek}"; fewer than 1 pair shows the exact empty copy of SRS 346.
- "Ringkasan Mingguan" sub-title "Minggu {n} ({dd/mm} - {dd/mm})" (ISO week, Monday-Sunday MYT), tiles "Pelajar Aktif" (XS-2, week), "Ketepatan" (XS-5, week; "—" none).
- Checklist ticks: class count > 0; pupil count > 0; at least one mission by this teacher; progress "{n}/3 langkah selesai" and "{p}%" = round(n ÷ 3 × 100).
- Stat cards: "Kelas Aktif" `classrooms.is_active`; "Soalan" = own contributions (XS-4b); "Tugasan" = number of own Set Soalan + own Misi ("Jumlah tugasan dibuat"). Empty "Penghantaran Terkini": "Belum ada penghantaran tugasan. Buat tugasan di kelas untuk mula mengumpul penghantaran." showing the 5 latest completed set attempts of own sets (pupil, set title, score "{betul}/{jumlah}", `dd/mm/yyyy`), "Urus set →" opens `/guru/set-soalan`.
- API: API-GUR-07 `GET /api/guru/dashboard`.

### R1-GUR-7 / R1-AS-7 Video (`/video`)
| Field | Type/Req/Default | Options / source | Validation + error |
|---|---|---|---|
| Category tabs | tabs, default "Semua ({n})" | "Semua ({n})", "Motivasi ({n})", "Tutorial ({n})", "Tips SPM ({n})", "Ceramah ({n})", "Lain-lain ({n})"; counts of visible videos | none |
| Tajuk Video * | text, required | max 150 | "Sila isi tajuk video."; "Tajuk video tidak boleh melebihi 150 aksara." |
| Pautan YouTube * | url, required | host `youtube.com`, `www.youtube.com`, `m.youtube.com` or `youtu.be` with a video id (the schema also allows other platforms, R1 teacher form accepts YouTube only per the label) | "Sila isi pautan YouTube."; "Pautan mesti pautan YouTube yang sah." |
| Subjek (pilihan) | select, "— Tiada subjek —" | OPT-SUBJEK | none |
| Kategori * | select, required, default "Lain-lain" (the V2 form shows no category; FR-GUR-7-2 and AC-GUR-7-2 require one, so V3 adds it) | "Motivasi", "Tutorial", "Tips SPM", "Ceramah", "Lain-lain" | "Sila pilih kategori." |
- Button "Tambah Video" shows the form, submit "Tambah Video"; success toast "Video ditambah."; list sorted newest first, 12 per page [PROPOSED]; card = thumbnail, title, category chip, subject, views; click opens the player page (16:9, `views` +1). Empty (all counts 0): "Tiada video buat masa ini" / "Video pembelajaran akan dipaparkan di sini". AS-7 (FR-AS-7-1): same list and tabs; the "Tambah Video" button and form are absent for `school_admin`; teachers see all global videos plus videos of their own school.

### R1-AS-1 Command Center and Aktiviti Harian
- Controls: tabs "📅 Hari Ini" (default), "🗓️ Minggu Ini", "🗒️ Bulan Ini" (query `period=hari|minggu|bulan`; API-AS-03 `date?`), link "Command Center" back, link "Lihat Aktiviti Harian". No form fields. Polls `live-data` every 10 s (API-AS-02), failed poll keeps old values silently.
- "Top Pelajar Minggu Ini" / "Top Pelajar": top 5 pupils by answers in the window (ties: accuracy descending, then name); "⚡ Live Feed": latest 15 answer rows of the school (HH:MM, pupil, subject, ✅/❌); "💚 Mood Pelajar": counts of check-ins by "😄 Gembira", "🙂 Okay", "😔 Sedih", "😣 Tertekan" over the window with footer "{n} check-in direkod"; "📊 Engagement (7 Hari)": 7 bars of answers per day, labels "Isn, Sel, Rab, Kha, Jum, Sab, Aha" (Monday first); "🔄 Pembetulan Soalan": "Laporan Baru" = reports with status open, "Selesai" = resolved (from `question_reports`); hour heat: 24 cells of answers per hour of today (MYT), labels 00, 03, ... 21.
- Aktiviti Harian cards as SRS 1087; "Sekolah Aktif" "daripada 1"; "Login Hari Ini" = pupils with `last_login_at` today (MYT), "—" when no login is recorded.

### R1-AS-4 Prestasi, R1-AS-6 Analisa Item
- AS-4: pills "Tingkatan" -> `/prestasi/tingkatan`, "Kelas" -> `/prestasi/kelas`; Tingkatan page chips/links `t1..t5` for each Tingkatan that has classes, label "Tingkatan n"; GPS band from the GPS value rounded to 2 decimals: <= 2.00 "Cemerlang", <= 4.00 "Baik", <= 6.00 "Sederhana", otherwise "Perlu Perhatian"; "Taburan Gred (Anggaran)" bars A+..G with "Jumlah: {n} rekod"; "Murid Terbaik" (top 10, >= 5 answers, accuracy descending, ties by answers) and "Murid Berisiko" (accuracy < 50 or inactive, 10 rows, accuracy ascending); "Perbandingan Kelas" sorted accuracy descending; all lists 25 per page where longer; percentages capped at 100. No input fields.
- AS-6: "Tingkatan:" chips "Semua" (default) then "Tingkatan n" for each with data (query `tingkatan=T1..T5`); search, sort, tabs and Diskriminasi exactly as the GUR-6 class page (search "Cari soalan...", sort select, tabs "Indeks Kesukaran"/"Indeks Diskriminasi"); school card "{n} Pelajar", "{n} Jawapan"; empty "Tiada Data Pelajar" / "Tiada data pelajar untuk sekolah ini. Pastikan pelajar telah berdaftar dan menjawab soalan latihan."

### R1-AS-45 Sekolah Bersaing
No input. Top 30 schools by average session accuracy (XS-5 rounded to a whole number for the pill), ties by "Pelajar" descending then school name ascending (Malay collation); pill colours >= 70 green, >= 50 amber, < 50 red; ranks 1-3 as 🥇 🥈 🥉; empty "Belum ada data" / "Tiada rekod latihan sekolah lagi."; API-AS-14 `GET /api/sekolah-bersaing` (no `week`).

### R1-AS-46 Statistik Penggunaan
Pills "Hari Ini" (1), "7 Hari" (7), "30 Hari" (30, default); query `days` (API-AS-08); cards "Pelajar", "Guru", "Pelajar Aktif" ("daripada {n}"), "Penglibatan" = round(aktif ÷ pelajar × 100) ("daripada pelajar daftar"), "Sesi Latihan", "Soalan Dijawab", "Purata Ketepatan" ("—" with footnote of FR-AS-46-2); table "Mengikut Mod Latihan" columns Mod · Sesi · Ketepatan Purata sorted by Sesi descending, mode labels as AS-48; empty "Tiada data untuk tempoh ini" (7 days: "Tiada aktiviti latihan dalam tempoh 7 Hari yang lepas."; 30 days: "...30 Hari yang lepas."; today: "Belum ada pelajar buat latihan hari ini. Cuba lihat 7 Hari atau 30 Hari.").

### R1-AS-47 DSKP Heatmap
"Subjek" select (OPT-SUBJEK limited to subjects with mapped answers or SP content; default the first; label placeholder none), "Tingkatan" toggle (buttons "Tingkatan 1".."Tingkatan 5" for levels with content; default the highest with content); `GET /api/admin-sekolah/dskp-heatmap?level=T1..T5` (API-AS-11); cell/legend per OPT-HEATBAND; empty subject "Tiada data penguasaan untuk subjek ini."; tapping a cell opens the SP detail (topic, answers, accuracy).

### R1-AS-48 Laporan Aktiviti
Pills OPT-JULAT (default "30 Hari"), tabs "Overview" (default), "Guru ({n})", "Murid ({n})" (API-AS-09 `range`, `tab=guru|murid`). Overview cards per SRS 1356 with "Murid Pernah Akses", "Cikgu Pernah Akses" (login recorded), "Murid Buat Latihan", "Jumlah Aktiviti", "Skor Purata" ("purata ketepatan sesi" = mean of per-session accuracy, whole %), "Trend Aktiviti ({n} hari)" (one bar per day, label dd/mm, scaled to data), "Pecahan Aktiviti" (labels "SPM Tahun Lepas", "Ulang Kaji", "SPM Mock", "SPM Ramalan", "Latih Tubi", "Tracking A", "Battle", "Permainan"), "Pelajar Paling Aktif (Top 10)", "Cikgu Belum Akses ({n})" (first 10 names, "+ {n} lagi" link opens the Guru tab). Guru tab columns # · Nama · Emel · Status ("Pernah Akses"/"Belum Akses") · Login Terakhir (`dd/mm/yyyy HH:mm` or "Belum login"), sorted login descending, never-logged last; Murid tab columns # · Nama · Kelas · Sesi · Soalan · Status · Login Terakhir, sorted Soalan descending, "Top 200" paginated 25. Empty "Tiada rekod sepadan."

### R1-AS-49 Amaran Awal
Level pills "Semua Tingkatan" (default) and "Tingkatan n" for each with pupils; buttons "Keberkesanan Intervensi", "Ringkasan Eksekutif" (with "Cetak / PDF"), "Muat Turun CSV". Score A/E/M per SRS 1388, shown with 1 decimal; Hijau + Kuning + Merah + Belum Bermula = XS-1 of the pill scope; list "Senarai Pelajar Berisiko" 25 per page by score descending, "Belum Bermula" last; "Analisis Risiko Mengikut Subjek" rows "{Subjek}" "{w}/{m} pelajar lemah ({p}%)" sorted p descending. API-AS-13.

### R1-AS-50 Laporan Bulanan - CORRECTION of Part 3
There are no "Bulan"/"Tahun" selects. Navigation is by the links "← {Bulan lepas}" and "{Bulan depan} →" (the latter absent for the current month; no future month), query `?bulan=YYYY-MM` (API-AS-10 `month=YYYY-MM`); an invalid or absent value = the current month (FR-AS-50-1, SRS 1426). Month names from OPT-BULAN. Header "Laporan {Bulan} {Tahun}", button "Cetak / PDF", footer "Laporan dijana: {dd/mm/yyyy HH:mm} · PrestasiPlus". "Trend Harian": one bar per day, label every 5th day.

### R1-AS-2 Dashboard (Delivery B)
No input fields. Cards: Jumlah Pelajar (XS-1), Jumlah Guru (XS-3), Kelas Aktif, "Langganan" (read-only status), "Guru Menunggu" link, GPS and "{n} entri headcount", "Perutusan Terkini" (newest visible, "Lihat semua →"; none: "Tiada perutusan."). Perutusan routes `/perutusan`, `/perutusan/:id`, `/perutusan/tulis`, `/perutusan/saya` belong to M09 (title/body fields of "Tulis Perutusan": Tajuk * max 150 "Sila isi tajuk perutusan.", Kandungan * max 2000 "Sila isi kandungan perutusan.", Skop fixed "Sekolah"; button "Hantar Perutusan"; success "Perutusan dihantar." [PROPOSED]).

### R1-AS-A1 Profil Saya
Fields: "Nama" * (max 255, "Sila isi nama."), "Telefon" (optional, digits with optional leading "+", 9 to 14 digits, "Nombor telefon tidak sah."), "E-mel" * ("Format e-mel tidak sah."; duplicate "E-mel sudah digunakan."); school block read-only: nama sekolah, "# Kod", PPD, negeri; button "Kemaskini Profil"; success "Profil dikemaskini." (BM message FR-AS-A1-2).

### R1-AS-A2 / A3 / A4
A2: same as GUR-A2 plus the read-only "Tetapan Akaun" rows; A3: same page as GUR-A3, default view the pupil guide, the card "Admin Sekolah" shows its guide (steps "Hubungi Admin PRESTASIPLUS", "Daftar Guru", "Import Pelajar"); A4: same as GUR-A4.

### Other confirmations from the full read
- AS-10: filter bar is "Tempoh" (OPT-TEMPOH-AS, default "Semua Masa") with "Tapis" and "Reset" only; no "Negeri", no "Tahap" (confirmed, DV-AS-10-2); table "Analisis Penglibatan Pelajar" sorted by Penglibatan descending; bands Cemerlang > 60, Sederhana 20-60, Rendah > 0 and < 20, Tiada 0 (whole-number %); 12 weekly columns "M1".."M12".
- GUR-10 pills and search as already listed; Status "Aktif" = >= 1 answer.
- GUR-6 FR-GUR-6-1: another teacher's class id = 403 "Akses Ditolak" (so GUR-6 follows the 403 rule of Part 1 GLB-2 exception list, not 404).
- XS-1..XS-8 are the calculation sources; screens read them from one query each (AC-XS-3).

---

# PART 6 - FINAL COUNTS AND OPEN ITEMS (replace Part 4)

## 6.1 Counts (every SRS section read; recount over the final register)
Field register rows by the SRS status they had before this spec: COMPLETE 41, PARTIAL 112, MISSING 27, of which MISSING with no source in SRS, V2 captures, code, 50 or 60 (fully [PROPOSED]): 9. Total 180 field/control rows over 47 screen blocks, 26 shared option sets (OPT-*). Behaviour items (a-h): 64 sub-items, COMPLETE 17, PARTIAL 37, MISSING 10. Every PARTIAL and MISSING item has a buildable specification above. `(unverified)` markers remaining: 0.

## 6.2 Items with NO source anywhere (written as [PROPOSED] and needing user confirmation)
1. Engagement band edges (the SRS bands overlap; no code defines them; SRS keeps the word ">50" so 50 is Konsisten).
2. Diskriminasi exact computation (SRS gives D = p_upper − p_lower with 27% groups; the 10-pupil minimum is marked proposed F-25; no code formula found).
3. Peer Tutor Matching rule (SRS gives only the empty copy).
4. The teacher structured-question submission form fields (only in terms of the intake contract).
5. Teacher-created teacher form in AS-52 (fields beyond the pupil form).
6. Telephone validation for AS-A1 and the Perutusan form fields.
7. Video category field on the teacher form (V2 hides it, FR requires it) and the school visibility of a teacher-added video.
8. BM texts of all [PROPOSED] validation, toast and confirm messages in Parts 1 and 3 (no source texts exist).
9. Page sizes where the SRS gives none (Set picker 50, Top 5/10 lists, video list 12).

## 6.3 DM / API changes the spec needs (no DM-ID exists in 50 yet; the owner must allocate IDs)
(a) unique index for class name per teacher and year; (b) unique username per school; (c) `missions` columns `description`, `reward_coins`, `scope`, `mission_type='harian'`, nullable `subject_id`; (d) `question_sets.education_level_id`; (e) `interventions.alert_type` value `other`; (f) `intake_batches`: `source` column, nullable `kertas`/`year`, free-text `subject` for guru, paper_type values `dskp`, `textbook`; (g) API-GUR-17 file types (PDF/DOCX/XLSX); (h) API-AS-06 limits (2 MB, 1000 rows); (i) API-GUR-22 body (qualification, experienceYears, ic, schoolId, single subject); (j) API-GUR-18 body (difficultyLevel, tp, cognitiveLevel, chapterId, spId).
