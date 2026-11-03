# Analisis jurang: Admin Pusat V1 / V2 / V3

Tarikh: 2026-11-03. Soalan: bolehkah Portal Pentadbiran V3 (`/admin`) mengurus semua yang dipaparkan portal murid, guru dan admin sekolah, seperti admin V1 dan V2?
Penamaan: V1 = prestasiplus.my, V2 = prestasiplus.cloud (`/admin` Blade) + Panel React (admin.prestasiplus.cloud), V3 = binaan baharu (repo "v2", branch `feature/v3-bijak-r1`).

## 0. Kaedah dan had (baca dahulu)

- Sumber: matriks akses (baris #1-#54), sidebar admin V2 (90 pautan) dan V1 (87 pautan) yang ditangkap hari ini, `routes/web.php` dan `resources/js/panel/**` V2, `menu.ts` V3, fail route/page/API V3, 40 tangkapan skrin sweep V3, `docs/discovery/v2-parity/admin.md` (audit 30 Okt), `v2-pentadbiran-backlog.md`.
- **Pemerhatian pelayar langsung TIDAK dibuat.** Selepas arahan tambahan, saya cuba log masuk ke V2 admin melalui lorong Playwright 3. Pengisian borang log masuk ditolak oleh pengelas kebenaran ("Identity Not Given") dan saya tidak mencari jalan lain. Satu klik hantar pada borang kosong sempat berlaku (tiada data dihantar). Pelayar ditutup. Maka lajur "Diurus di V1/V2" berasaskan kod, sidebar tangkapan dan dokumen, bukan pemerhatian langsung hari ini. Untuk pemerhatian langsung, pengguna perlu memberi kebenaran khusus supaya lorong 3 boleh mengisi borang log masuk; kemudian hanya bahagian pelayar perlu diulang.
- V3 "dibina" = ada dalam menu (`built: true`) atau ada route walaupun tiada dalam menu. Status 429 dalam sweep V3 ialah pengehad kadar, bukan ralat skrin; KK-01 pulih pada cubaan semula.
- Fokus fungsi sahaja; kualiti visual tidak dinilai.

## 1. Ringkasan

| Ukuran | Nilai |
|---|---|
| Item menu V3 ditakrif (`PENTADBIRAN_FULL_MENU`) | 106 |
| Dibina dan dipaparkan | 40 |
| Tersembunyi (tiada route) | 66 (backlog menyebut 68; dikemas kini selepas Kertas/Set Builder) |
| Pautan sidebar admin V2 / V1 | 90 / 87 |
| Baris matriks #1-#54 diurus penuh oleh admin pusat V3 | 8 (#1, 11, 19, 20, 24, 27, 51, 52) |
| Separa | 10 (#6, 9, 10, 13, 17, 25, 26, 41, 44, 54) |
| Tiada skrin admin langsung | 32 |
| Tiada pengurusan khusus pun di V1/V2 (tiada jurang) | 4 (#12, 14, 18, 39) |

Kesimpulan: admin V3 boleh mengurus **jalur kandungan soalan (Bank Soalan, SPM, Bijak SPM), kurikulum, kandungan (artikel/nota/banner/audio), pengguna/sekolah/langganan, PKSK dan pemantauan (Command Center, Monitoring, Kirkpatrick)**. Admin V3 **tidak boleh** mengurus ekonomi murid (syiling, cabaran, hadiah, cabutan, marketplace), permainan, penajaan/anak angkat/duta, kewangan, tetapan sistem, kawalan ciri, log audit, notifikasi, chatbot, laporan/analitik pusat dan dashboard. Untuk gamifikasi, hadiah dan permainan, API V3 sudah ada; yang tiada ialah skrin dan item menu.

Keterukan: K = Kritikal (murid nampak modul tetapi admin tidak boleh mengurusnya), T = Tinggi, S = Sederhana, R = Rendah.

## 2. Jadual baris demi baris (matriks #1-#54)

Kunci V3: ✅ dibina, ⚠️ separa, ❌ tiada skrin, 🔁 pendua/bercanggah. ID menu ialah ID dalam `menu.ts`.

| # | Modul (peranan) | Diurus di V1 | Diurus di V2 (/admin + Panel) | Diurus di V3 | Jurang V3 | Ket. | Bukti |
|---|---|---|---|---|---|---|---|
| 1 | Command Center (guru, admin sekolah) | `/admin/command-center`, `/daily-activity` | sama + `/live`; Panel Papan Pemuka | PM-01, PM-02 ✅ + drill sekolah/guru/kelas/pelajar | Tiada jurang | R | sweep5193/PM-01.png, PM-02.png; `m17/routes/command-center.ts:14,110` |
| 2 | Dashboard / Dashboard Guru (semua) | `/admin` | `/admin`; Panel `/` | PP-01 ❌. `/admin` hanya redirect ke Command Center; hub pratonton hanya dev | Tiada dashboard pusat | T | `menu.ts` PP-01; `m17/routes/dashboard.ts` (kosong); `core-routes.ts:84-88` |
| 3 | Headcount (semua) | Dashboard, Laporan | Dashboard, Monitoring | PM-24 ❌ (halaman guru/sekolah ada) | Admin pusat tiada kiraan headcount | S | `menu.ts` PM-24 |
| 4 | Prestasi (semua) | Laporan, Analitik | `/admin/analytics`; Panel `/analitik` | PM-25, PM-04 ❌ | Tiada analitik pusat | T | `m17/routes/analytics.ts` (kosong) |
| 5 | Analitik Adaptif (semua) | Analitik | Analitik | PM-26 ❌ | Sama #4 | S | backlog PM-26 |
| 6 | Analisa Item (guru, admin sekolah) | Kualiti Soalan, Analitik | Analitik, Kualiti | BS-04 ✅ (kualiti); analisis item pusat ❌ | Separa | S | sweep BS-04.png |
| 7 | Video (semua) | tiada dalam sidebar | Filament `/admin-filament/videos` | KK-08 ❌. BE `/api/videos` CRUD ada; skrin hanya dalam shell pengguna | Tiada senarai/moderasi di Pentadbiran | T | `menu.ts` KK-08; admin.md C05 |
| 8 | Kelas Saya (murid, guru) | Pengguna, Sekolah | sama | PS-03 ❌; drill kelas hanya dalam Command Center | Admin tidak boleh urus kelas sebagai senarai | S | `m17/routes/command-center.ts:66` |
| 9 | Soalan by Chapter (murid, guru) | Senarai Soalan + Kurikulum | Studio + Kurikulum | KK-01 ✅, BS-01/BS-08 ✅ | Fungsi ada; data DSKP kosong di UAT pada audit 30 Okt (belum disahkan semula) | T | KK-01-retry.png; admin.md C04 |
| 10 | Monitoring (guru, admin sekolah) | `/admin/monitoring` | `/admin/monitoring` (+CSV/PDF) | PM-03 ✅ tetapi menuju `/guru/monitoring`; `/admin/monitoring` dipasang tetapi tidak dipakai | Eksport CSV/PDF tiada; menu tidak sepadan laluan | S | `menu.ts` PM-03; `m17/routes/monitoring.ts`; PM-03.png |
| 11 | Kirkpatrick (guru, admin sekolah) | 7 skrin | 7 skrin + PDF | PM-05..11 ✅ | Tiada jurang | R | PM-05..11.png |
| 12 | Remedial (murid) | tiada skrin khusus | sama | - | Tiada jurang | R | cloud-student-mechanism §2.6 |
| 13 | SPM / Bijak SPM (murid) | Import CSV, Senarai Soalan, `/spm/*` | Import & Semakan, Studio, Set Builder, Terbit; Kontrak (Panel); hub 6 lorong; Tracking A; Kertas Subjektif; Sumber Kertas | KS-13/14/15/16/02/08/09/17, BS-02, BS-08 | ⚠️🔁 Lihat bahagian 4 dan 5 (hub 2/6 kad, tiada Tracking A, Kertas Subjektif, Sumber Kertas; menu pendua) | K | KS-01.png, KS-14.png; `m28/routes/admin-kandungan.ts:13-25` |
| 14 | Heatmap Topik Lemah (murid) | tiada | tiada | - | Tiada jurang | R | admin.md §1 |
| 15 | Mohon Keluarga Angkat (murid) | Penajaan, Anak Angkat, Permohonan | sama | PG-16/17/18 ❌; BE hanya `POST /mohon-keluarga-angkat` | Permohonan tiada peluluskan | T | `m21/routes/admin.ts`; `sponsorship.controller.ts:20` |
| 16 | Latih Tubi (murid) | `/spm/latih-tubi` | lorong `latih-tubi` + Studio + Kawalan Ciri | KS-03 ❌; flag tiada | Tidak nampak apa menghalang; tiada togol | T | `menu.ts` KS-03; admin.md A21/A25 |
| 17 | Soalan Berstruktur (murid) | `/admin/structured-questions` | sama + penyunting rubrik (Panel) | Route ada, **tiada menu**, BE baca sahaja | Tiada suntingan rubrik/skema | T | `m04/routes/structured.ts:12,26` |
| 18 | Kedudukan (murid) | Ranking Sekolah (halaman murid) | sama | - | Tiada jurang | R | sidebar V2 |
| 19 | PKSK (murid) | PKSK Soalan + Akses | sama | BS-06, KW-06 ✅ | Tiada jurang | R | BS-06.png, KW-06.png |
| 20 | Artikel (murid) | Artikel, Banner | sama | KK-06, KK-05 ✅ | Tiada jurang | R | KK-06.png |
| 21 | Permainan (murid) | Tetapan Permainan | `/admin/permainan` | PG-11 ❌; BE `admin/games` + klien FE ada, tiada halaman | Tidak boleh tetapkan/matikan permainan | T | `games/rooms/admin/admin-games.controller.ts`; `m16/api/game-types.ts` |
| 22 | Cabutan Bertuah (murid) | Kawalan Reward | Filament lucky-draws, Kawalan Reward | PG-09/10 ❌; BE `POST draws` ada | Tidak boleh cipta cabutan | T | `gamification/admin.controller.ts:143` |
| 23 | Tournament (murid) | Battle Live, Tetapan Permainan | sama | ❌ | Tournament tidak boleh diurus admin | T | `battle/tournaments/tournaments.controller.ts` (tiada FE admin) |
| 24 | Topik (murid) | Kurikulum | Kurikulum | KK-01 ✅ | KK-03 "Bab" ditanda tersembunyi walaupun skrin wujud di bawah Kurikulum | R | `m03/routes` |
| 25 | Peta Belajar (murid) | Kurikulum | Kurikulum | KK-01 ✅ | Sama #9 | S | - |
| 26 | Set Soalan Guru (murid) | Kertas Soalan Guru `/admin/question-submissions` | tab "Kiriman Guru" | Route ada, tiada menu, BE tiada (mock) | Kiriman guru tidak boleh dilihat | T | `m04/routes/submissions.ts:11`; admin.md A10 |
| 27 | Audio KBAT (murid) | Audio KBAT | sama | BS-07 ✅ | Tiada jurang | R | BS-07.png |
| 28 | Syiling & Token (murid) | Gamifikasi Overview/Pelajar/Transaksi | sama | PG-01/04/05 ❌; BE `admin/gamification` + klien `m14/api/admin.ts` ada, tiada halaman | Tidak boleh lihat/laras baki atau beri syiling | K | `gamification/admin.controller.ts:26-105`; `m14/pages` (murid sahaja) |
| 29 | Tukar Token (murid) | Tier Config | sama | PG-02 ❌; BE tiers CRUD | Kadar tukaran tidak boleh ditetapkan | K | `admin.controller.ts:31-48` |
| 30 | Cabaran Harian (murid) | Gamifikasi Cabaran | sama | PG-03 ❌; BE challenges CRUD | Cabaran tidak boleh dicipta | K | `admin.controller.ts:55-79` |
| 31 | Kedai Hadiah (murid) | `/admin/hadiah` | sama | PG-06 ❌; BE `shop/admin.controller.ts` (tebusan, hantar, batal) + `m15/api/admin.ts`, tiada halaman | Tebusan tidak boleh disempurnakan | K | `shop/admin.controller.ts:24-66` |
| 32 | Marketplace (murid) | Produk, Penjual | sama | PG-14/15 ❌; BE baca sahaja | Produk/penjual tidak boleh diurus | K | `marketplace.controller.ts:18-43` |
| 33 | Papan Pendahulu (murid) | Gamifikasi Pelajar, Battle Leaderboard | sama | PG-04/13 ❌ | Tiada tetapan/semakan | S | `menu.ts` |
| 34 | Pencapaian (murid) | tidak disahkan | tidak disahkan (Filament?) | ❌ | Tidak disahkan | S | - |
| 35 | Kotak Misteri (murid) | Kawalan Reward | sama | PG-10 ❌; BE `rewards/:id/cost` | Ganjaran tidak boleh ditetapkan | T | `admin.controller.ts:137` |
| 36 | Rujuk Kawan (murid) | Gamifikasi tetapan | sama | PG-01 ❌; BE `settings` ada | Tetapan tidak boleh diubah | S | `admin.controller.ts:105-110` |
| 37 | Cikgu Alesa (murid) | Chatbot | Chatbot (analitik, pengetahuan, perbualan) | PG-21 ❌; AI disembunyi (D73) | Disengajakan sementara | S | memori "ALESA AI hidden" |
| 38 | Kedai Hadiah Digital (murid) | Hadiah | sama | Sama #31 | Sama #31 | K | `m15/routes/digital.ts` |
| 39 | Timeline Saya (murid) | tiada | tiada | - | Tiada jurang | R | - |
| 40 | Jemput Ibu Bapa (murid) | Pengguna | Pengguna (`parent-links` BE) | ❌; BE `admin/parent-links` tiada FE | Pautan ibu bapa tidak boleh diurus | S | admin.md §4 |
| 41 | Pelajar Saya (guru) | Pengguna, Import Pelajar | sama; Panel `/pengguna` | PS-01/04/06 ✅; Import Pengguna ada route tetapi tiada menu | PS-05 tersembunyi; impersonate tiada (BE 404 sengaja) | S | PS-01.png, PS-04.png; `m02/routes/imports.ts` |
| 42 | Laporan (guru) | `/admin/laporan` | sama | ❌ | Tiada laporan pusat | T | `m17/routes/laporan.ts` (kosong) |
| 43 | Laporan Mingguan (guru) | Laporan, Notifikasi | sama | ❌ | Tiada pengurusan pusat | S | - |
| 44 | Sumbang Soalan (guru) | Senarai Soalan (luluskan `menunggu`), Kertas Soalan Guru | Import & Semakan + Kiriman Guru | BS-01 ✅, KS-15 ✅ | Separa: Kiriman Guru tiada; dua baris gilir semakan 🔁 | T | KS-15.png, BS-02.png |
| 45 | Sekolah Bersaing (admin sekolah) | `/sekolah-bersaing` | sama | PM-28 ❌ | Tiada pemantauan pusat | S | - |
| 46 | Statistik Penggunaan (admin sekolah) | Analitik | Analitik | PM-15 ❌ (sekolah ada di M27) | Pandangan pusat tiada | S | `m27/routes/statistik.ts` |
| 47 | DSKP Heatmap (admin sekolah) | Kurikulum | Kurikulum | PM-21 ❌ (sekolah ada) | Pandangan pusat tiada | S | `m27/routes/dskp.ts` |
| 48 | Laporan Aktiviti (admin sekolah) | Laporan | Laporan | PM-12 ❌ (sekolah ada) | Pandangan pusat tiada | S | `m27/routes/aktiviti.ts` |
| 49 | Amaran Awal (admin sekolah) | Wellbeing Alerts | sama | PM-22/13 ❌; M18 `/amaran/*` di luar menu | Pandangan pusat tiada | S | `m18-ppd-jpn/routes.ts:28,43` |
| 50 | Laporan Bulanan (admin sekolah) | Laporan | Laporan | PM-23 ❌ (sekolah ada) | Pandangan pusat tiada | S | `m27/routes/bulanan.ts` |
| 51 | Senarai Pelajar (admin sekolah) | Pengguna | Pengguna | PS-01 ✅ | Tiada jurang | R | PS-01.png |
| 52 | Senarai Guru (admin sekolah) | Pengguna | Pengguna | PS-01 ✅ | Tiada jurang | R | - |
| 53 | Kelas Sekolah (admin sekolah) | Sekolah | Sekolah | PS-03 ❌ | Sama #8 | S | - |
| 54 | Laporan Soalan (murid 1.0) | `/admin/question-reports` | sama + tile Analitik | BS-05 ✅ | Tindakan sembunyi/arkib daripada baris tidak disahkan | S | BS-05.png; admin.md A15 |

## 3. Menu admin V2 yang tiada di V3

| Menu V2 | Laluan | Keadaan di V3 |
|---|---|---|
| Dashboard | /admin | tiada (PP-01) |
| Laporan Eksekutif | /admin/laporan-eksekutif | tiada dalam /admin; versi M18 `/amaran/ringkasan-eksekutif` |
| Analitik | /admin/analytics | tiada |
| Laporan | /admin/laporan | tiada |
| Sumber Kertas | /admin/source-papers | tiada (BS-03; keputusan D-10) |
| Kertas Subjektif | /admin/kertas-subjektif | tiada (KS-07) |
| Soalan Berstruktur | /admin/structured-questions | route ada, tiada menu |
| Import Pengguna | /admin/users/bulk-import | route ada, tiada menu |
| Penajaan, Anak Angkat, Permohonan | /admin/sponsors, /anak-angkat* | tiada |
| Lorong SPM: Latih Tubi, Tracking A, Subjektif | /admin/spm/{lane} | tiada; hub V3 hanya 2 kad |
| Kawalan Ciri | /admin/feature-toggles | tiada; sekitar 25 flag V2 tidak dimodelkan |
| Gamifikasi (Overview, Tier, Cabaran, Pelajar, Transaksi) | /admin/gamification* | tiada FE (BE ada) |
| Kedai Hadiah | /admin/hadiah | tiada FE (BE ada) |
| Gamifikasi Guru | /admin/gamifikasi/guru | tiada FE dan BE |
| Kawalan Reward | /admin/reward-control | tiada FE (BE ada) |
| Tetapan Permainan | /admin/permainan | tiada FE (BE ada) |
| Produk, Penjual | /admin/marketplace/* | tiada |
| Notifikasi | /admin/notifications | tiada |
| Pembayaran, Billing, Dunning | /admin/payments, /billing, /dunning | tiada |
| Tetapan | /admin/settings | tiada |
| Prestasi Sistem | /admin/performance | tiada |
| Audit Logs | /admin/audit-logs | tiada; tiada endpoint BE |
| Chatbot | /admin/chatbot | tiada (AI disembunyi) |
| Permohonan Duta | /admin/duta-applications | tiada |
| Panel: Analitik, Tanda Karangan, penyunting Tracking A, Kertas CRUD, Simulasi review (Salin set, bahan rujukan, soalan tambahan), togol/kod gabung sekolah | Panel | tiada atau separa |
| Eksport (pengguna, soalan, sekolah, pembayaran, audit) | /admin/export/* | tiada |

V1 sahaja: Import CSV soalan (route V3 ada, tiada menu) dan Kertas Soalan Guru (route ada, tiada menu).

## 4. Menu admin V3 yang tiada di V2 atau pendua

| Item V3 | Masalah | Bukti |
|---|---|---|
| BS-01 `/admin/questions`, BS-08 Studio `/admin/studio`, KS-02 `/admin/spm/soalan` | Tiga senarai "Bank Soalan". V2 ada dua (Senarai Soalan lama dan Studio); KS-02 tambahan V3 | menu.ts; BS-01/BS-08/KS-02.png (baris 20/25/1) |
| BS-02 Import & Semakan dan KS-14 Senarai Ekstrak | Skrin sama `/admin/spm/soalan/ekstrak`; tab "Kertas Diimport" dan "Kiriman Guru" V2 tiada | komen BS-02 dalam menu.ts |
| KS-15 Baris Gilir Semakan dan semakan kelompok ekstrak | Dua baris gilir semakan berlainan (soalan `semakan` vs kelompok ekstrak) | `ReviewQueuePage.vue`; `IntakeListPage.vue` |
| KS-09 Pembina Kertas `/admin/spm/kertas` dan KS-17 Set Builder `/admin/studio/sets` | Senarai kertas yang sama dua kali; V2 ialah satu aliran Set Builder. "Kertas" Panel V2 ialah Kertas Subjektif | admin.md A18/A23; KS-09/KS-17.png |
| KS-08 Kontrak Simulasi dalam menu | V2 mencapai Kontrak dari pembina/Panel tanpa entri sidebar | `Panel web.php:263` |
| KS-13 Muat Naik, KS-16 Tulis Manual | Tambahan V3 yang diputuskan (D52); bukan jurang | admin.md A05/A06 |
| KS-01 hub "SPM" 2 kad | V2 enam kad | `lanes.ts`, `admin-kandungan.ts` |
| PM-03 Monitoring menuju `/guru/monitoring` | Laluan guru dalam menu admin; V1/V2 `/admin/monitoring` | `menu.ts` |
| PG-22 Tiket Bantuan | V2 `/admin/tiket` ada tetapi tiada dalam sidebar tangkapan; V3 baca sahaja | `support.controller.ts:75` |

## 5. Lima belas jurang teratas (kesan pada "admin boleh jalankan portal murid")

1. **Gamifikasi: Tier Config, Cabaran, Overview, Pelajar, Transaksi (#28-30, 33, 36).** Punca: `m14/pages` hanya murid; API `/admin/gamification` dan klien `m14/api/admin.ts` siap tetapi tiada halaman, dan PG-01..05 tiada route.
2. **Kedai Hadiah, Hadiah digital, Kotak Misteri, Kawalan Reward (#31, 35, 38).** Punca: BE `shop/admin.controller.ts` ada; tiada halaman admin (PG-06, PG-10).
3. **Marketplace Produk/Penjual (#32).** Punca: BE hanya baca (route awam); tiada modul admin di BE mahupun FE.
4. **Kawalan Ciri / togol (#16, #21 dan lain-lain).** Punca: tiada migrasi flag dan tiada endpoint (rancangan S8.1 belum dibina); keterlihatan V3 ditentukan masa-bina (`prototype-scope`).
5. **Hub SPM tidak lengkap dan Tracking A (#13, #16).** 2 daripada 6 kad; set Tracking A tiada penyunting (set kosong = murid nampak sifar). Punca: M28 hanya bina lorong Databank dan Bijak SPM; `spm_tracking_sets` seed sahaja.
6. **Kertas Subjektif dan Sumber Kertas (#13).** Punca: dirancang (S6, D81) tetapi belum dibina; Sumber Kertas diputuskan tidak dibina (D-10).
7. **Aliran terbit Bijak SPM belum disahkan penuh.** Pembina Kertas, Set Builder dan Kontrak kini ada, tetapi dua senarai kertas yang sama (KS-09 vs KS-17), senarai blocker per baris, pengecualian kontrak beraudit dan "Dilihat murid di" belum disahkan. Punca: M28 dibina berperingkat tanpa menyatukan menu.
8. **Menu soalan berganda dan dua baris gilir semakan (#9, 16, 44).** Punca: tiga modul (M04 lama, Studio, M28) menambah menu tanpa digabungkan.
9. **Permainan, Cabutan, Tournament (#21-23).** Punca: BE `admin/games` ada, klien FE ada tanpa halaman; tiada admin tournament di BE dan FE.
10. **Penajaan, Anak Angkat, Duta (#15).** Punca: `m21/routes/admin.ts` kosong ("ditangguh M21-T4"); BE hanya menerima permohonan.
11. **Kiriman Guru / Set Soalan Guru (#26, 44).** Punca: FE `SubmissionListPage` dan route ada, tetapi BE `/api/question-submissions` tiada dan tiada menu.
12. **Dashboard, Analitik, Laporan, Laporan Eksekutif (#2, 4, 5, 42, 43, 46-50).** Punca: `m17/routes/{dashboard,analytics,laporan,laporan-eksekutif}.ts` kosong; pandangan sekolah wujud di M27 tetapi tidak diangkat ke tahap pusat.
13. **Soalan Berstruktur tanpa suntingan rubrik (#17).** Punca: BE baca sahaja; route tersembunyi daripada menu.
14. **Tetapan, Notifikasi, Audit Log, Pembayaran/Billing/Dunning, Chatbot.** Punca: tiada modul BE untuk kebanyakannya; diputuskan KIV.
15. **Video, Kelas Sekolah, Import Pengguna tersembunyi (#7, 8, 41).** Punca: `menu.ts` memaparkan item yang ada route sahaja; skrin dibina di luar Pentadbiran (shell pengguna) atau route wujud tanpa mendaftar item menu.

## 6. Yang tidak diperiksa

- Pemerhatian langsung V1/V2: tidak dibuat (bahagian 0).
- Panel React: dibaca daripada `routes/web.php` dan `run-v2.log` (Papan Pemuka, Analitik, Pengguna, Sekolah, Kandungan SPM, Question Studio).
- #34 (Pencapaian) dan #39 (Timeline): pengurusan admin tidak ditemui/disahkan di V1/V2.
- Isi skrin V3 tidak disemak melebihi tajuk, kiraan baris dan penanda sweep.
