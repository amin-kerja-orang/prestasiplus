# Pengesahan langsung V2 dan V1 untuk analisis jurang V3 (2026-11-08)

Skop (arahan pemilik produk, dikemas kini semasa kerja): hanya MODUL, CIRI dan FUNGSI (menu, medan, tindakan, langkah, peraturan, keadaan, salinan BM) dan sama ada V3 ada fungsi yang sama. Bilangan rekod dan jumlah data TIDAK dibandingkan (pangkalan data UAT mungkin tidak betul); angka yang kebetulan kelihatan pada skrin tidak dicatat sebagai bukti.

Rujukan laporan: `MURID.md`, `GURU-ADMIN-SEKOLAH.md`, `ADMIN-PUSAT.md` (dalam folder ini). `DATA-GAP.md` hanya latar. Baris dirujuk sebagai `ADMIN-PUSAT #n` (jadual modul bahagian 2) atau bahagian laporan.

## 0. Ringkasan operasi

- Pelayar: hanya `mcp__playwright__*` (lorong 1), berkepala, satu tab. Log masuk SEKALI setiap tapak (V2 dan V1), sesi digunakan semula. Tiada kelayakan ditulis dalam fail atau laporan.
- Jarak antara navigasi sekurang-kurangnya 20 saat (tunggu 10-12 saat ditambah pemprosesan). Tiada muat semula, tiada `evaluate`/`run_code`, tiada permintaan selari, tiada crawl. Hanya baca: tiada borang dihantar, tiada butang tulis ditekan.
- V2 dilawat dahulu, kemudian V1. Tidak pernah serentak.
- **Peristiwa Cloudflare: TIADA** (tiada "Just a moment", Turnstile, 403/429/1020/1015) pada kedua-dua tapak.
- **Peristiwa kebenaran (permission): TIADA** (tiada panggilan alat ditolak).
- Ralat dan keanehan: (a) `admin.prestasiplus.cloud` gagal `ERR_NAME_NOT_RESOLVED` (DNS tidak wujud, BUKAN Cloudflare; satu cubaan sahaja, tidak diulang); (b) tinjauan NPS "Maklum Balas Anda Penting" muncul pada admin V2 dan menghalang klik menu; ditutup dengan butang "Nanti dulu" (tiada maklum balas dihantar; tindakan ini mungkin merekod penolakan pada sisi V2). (c) Beberapa panggilan klik sidebar dihantar serentak (tindakan klien sahaja, bukan permintaan pelayan).
- Bilangan halaman: V2 29 navigasi (lebih 4 daripada had 25 yang dicadangkan, kerana skrin sidebar/Filament perlu dibuka untuk menyenaraikan menu penuh; tiada satu pun halaman data/kiraan); V1 12 navigasi (had 15). Masa (MYT, UTC+8): V2 11:29 hingga 11:44, V1 11:44 hingga 11:50.
- Tangkapan skrin: tiada diambil (tidak perlu; bukti ialah teks pokok kebolehcapaian). Senarai pendek ditulis ke folder scratch `...\scratchpad\gap-live\shortlist.md`.
- Privasi: skrin V2/V1 memaparkan nama sebenar murid, guru dan sekolah (Top 10 Pelajar, kiriman guru). Tiada nama dicatat di sini.

## 1. Halaman dilawat

### V2 (prestasiplus.cloud)

| # | Laluan | Masa MYT | Perkara dibaca |
|---|---|---|---|
| 1 | `/login` lalu `/admin` (dashboard) | 11:29 | log masuk e-mel (borang awam menerima peranan admin), sidebar penuh |
| 2 | `/admin/feature-toggles` | 11:32 | Kawalan Ciri |
| 3 | `/admin/gamification` | 11:33 | Overview Gamifikasi |
| 4 | `/admin/gamification/tiers` | 11:33 | Tier Config |
| 5 | `/admin/gamification/challenges` | 11:33 | Cabaran Harian |
| 6 | `/admin/hadiah` | 11:34 | Kedai Hadiah Digital |
| 7 | `/admin/reward-control` | 11:34 | Kawalan Reward |
| 8 | `/admin/permainan` | 11:35 | Tetapan Permainan |
| 9 | `/admin/analytics` | 11:35 | Analitik & Statistik |
| 10 | `/admin/laporan` | 11:35 | Laporan |
| 11 | `/admin/laporan-eksekutif` | 11:36 | Laporan Eksekutif |
| 12 | `/admin/studio/imports` | 11:36 | Studio Import: tab Kelompok Item |
| 13 | `/admin/studio/imports?tab=kertas` | 11:37 | tab Kertas Diimport |
| 14 | `/admin/studio/imports/paper/360/review` | 11:37 | skrin Semak kertas (dibuka sahaja) |
| 15 | `/admin/studio/sets` | 11:38 | Set Builder |
| 16 | `/admin/spm` | 11:38 | hub SPM |
| 17 | `/admin/spm/tracking-a` | 11:39 | senarai Tracking A |
| 18 | `/admin/spm/tracking-a/1/sunting` | 11:39 | penyunting set Tracking A |
| 19 | `/admin/spm/latih-tubi` | 11:39 | lorong Latih Tubi |
| 20 | `/admin/spm/kertas` | 11:40 | lorong Kertas Subjektif |
| 21 | `/admin/studio` | 11:40 | Bank Soalan (Studio) |
| 22 | `/admin/studio/questions/create` | 11:41 | borang Cipta soalan (tidak dihantar) |
| 23 | `/admin/question-submissions` | 11:41 | Kiriman Guru |
| 24 | `/admin/structured-questions` | 11:41 | senarai Soalan Berstruktur |
| 25 | `/admin/structured-questions/4061` | 11:42 | penyunting Skema & Rubrik (tidak dihantar) |
| 26 | `/admin/source-papers` | 11:42 | Sumber Kertas |
| 27 | `/admin/users/bulk-import` | 11:43 | Import Pengguna Pukal |
| 28 | `https://admin.prestasiplus.cloud` | 11:43 | `ERR_NAME_NOT_RESOLVED` (domain tidak wujud) |
| 29 | `/admin-filament` | 11:43 | panel Filament (menu dibaca) |
| 30 | `/admin-filament/lucky-draws` | 11:44 | Cabutan (Filament) |

### V1 (prestasiplus.my)

`/login` lalu `/admin` (dashboard, sidebar), `/admin/questions`, `/admin/questions/import`, `/admin/questions/create`, `/admin/question-submissions`, `/admin/gamification`, `/admin/reward-control`, `/admin/permainan`, `/admin/laporan`, `/admin/analytics`, `/admin/hadiah` (11:44 hingga 11:50).

## 2. Menu penuh

### 2.1 Sidebar admin V2 (`prestasiplus.cloud/admin`, Blade, "Panel Pentadbir")

Tajuk bahagian: HARIAN, ANALITIK, PENGURUSAN, SISTEM. Kumpulan boleh kembang. Pengguna dalam sesi: "Admin" (peranan admin).

- HARIAN: Command Center (LIVE) `/admin/command-center`; Aktiviti Harian `/admin/command-center/daily-activity`; Audio KBAT `/admin/audio-kbat`
- ANALITIK: Dashboard `/admin`; Laporan Eksekutif `/admin/laporan-eksekutif`; Analitik `/admin/analytics`; Monitoring `/admin/monitoring`; kumpulan Kirkpatrick (Overview, T1: Reaksi, T2: Pembelajaran, T3: Tingkah Laku, T4: Hasil, Rantaian Impak, Intervensi); Laporan `/admin/laporan`
- PENGURUSAN
  - Kurikulum: Kurikulum `/admin/curriculum`, Subjek `/admin/subjects`, Tahap Pendidikan `/admin/education-levels`
  - Soalan: SPM (hub) `/admin/spm`, Bank Soalan (Studio) `/admin/studio`, Import & Semakan `/admin/studio/imports`, Set Builder `/admin/studio/sets`, Sumber Kertas `/admin/source-papers`, Kertas Subjektif `/admin/kertas-subjektif`, sub-kumpulan **Bank Lama (Legasi)** (mengandungi Senarai Soalan `/admin/questions` dan Soalan Berstruktur `/admin/structured-questions`)
  - Pengguna: Senarai Pengguna, Sekolah, Langganan Sekolah `/admin/school-subscriptions`, Import Pelajar `/admin/import-students`, Pelajar Komplimen `/admin/comp-students`, Import Pengguna `/admin/users/bulk-import`, Penajaan `/admin/sponsors`, Anak Angkat `/admin/anak-angkat`, Permohonan `/admin/anak-angkat/permohonan`
  - SPM (sisi pelajar, pautan keluar): Databank Soalan `/spm/tahun-lepas`, Latih Tubi `/spm/latih-tubi`, Tracking A `/spm/ramalan`, Subjektif `/spm/subjektif`
  - Premium: PKSK Soalan `/admin/pksk/questions`, PKSK Akses `/admin/pksk/access`
- SISTEM
  - Kawalan Ciri `/admin/feature-toggles`
  - Gamifikasi: Overview, Tier Config, Cabaran, Pelajar, Transaksi, Kedai Hadiah `/admin/hadiah`, Gamifikasi Guru `/admin/gamifikasi/guru`, Kawalan Reward `/admin/reward-control`
  - Battle & Permainan: Battle Live `/battle`, Ranking Sekolah, Leaderboard, Tetapan Permainan `/admin/permainan`
  - Marketplace: Produk, Penjual
  - Kandungan: Artikel, Banner, Nota, Notifikasi `/admin/notifications`, Screenshots `/admin/tools/screenshots`
  - Kewangan: Pembayaran, Billing `/admin/billing`, Dunning `/admin/dunning`
  - Sistem: Tetapan `/admin/settings`, Prestasi Sistem `/admin/performance`, Audit Logs `/admin/audit-logs`, Chatbot `/admin/chatbot`
  - Kerjaya / Duta: Permohonan Duta `/admin/duta-applications`, Bilik Duta, Kem & Bootcamp, Akademi Duta, Dashboard Duta, Jemput Duta
  - Pusat AI: Kamus AI, SPM Walkthrough, Aktiviti Advisor, Pendamping Motivasi, Whiteboard → Quiz, Parent Whisperer, Doa & Motivasi
  - Pratonton Pelajar (pintasan ke skrin pelajar): Dashboard Pelajar, Kombo, Cita-Cita, Profil Cerah, Cikgu Suara, SPM Mock Exam, Sekolah Bersaing, Wellbeing Alerts, Tetapan Peribadi
  - pautan "Ke Dashboard" `/dashboard`
- Dashboard `/admin`: kad "Soalan Aktif / Diluluskan / Menunggu Review / Draf / Subjek / Tahap Pendidikan / Pengguna", kad Battle Arena (Total/Aktif/Selesai), kad penajaan (Jumlah Penaja, Menunggu Kelulusan, Ditolak, Digantung), tiga "Tindakan Pantas" (Tambah Soalan Baru, Tambah Subjek Baru, Import & Semakan Soalan), jadual "Soalan Terkini" (Soalan, Subjek, Tahap, Status, Tarikh) + "Lihat Semua", "Taburan Status Soalan" (Draf, Menunggu, Diluluskan, Ditolak, Diarkib), "Pautan Pantas" (Kurikulum, Analitik, Banner, Artikel) dan "Muat Turun Data (CSV)" (Pengguna, Soalan, Pembayaran, Sekolah).

### 2.2 "Panel menu" admin.prestasiplus.cloud

**Tidak wujud sebagai tapak langsung**: `https://admin.prestasiplus.cloud` tidak diselesaikan DNS (`ERR_NAME_NOT_RESOLVED`). Panel kedua yang benar-benar hidup ialah **Filament di `prestasiplus.cloud/admin-filament`** (pengguna yang sama, sesi sama). Menunya:

- Harian/Analitik: Command Center, Aktiviti Harian, Audio KBAT, Dashboard, Laporan Eksekutif, Analitik, Monitoring, Kirkpatrick, Laporan
- Kurikulum: Kurikulum, Subjek, Tahap Pendidikan, **Bab**
- Soalan: Senarai Soalan, **Import CSV**, **Kualiti Soalan**, **Laporan Soalan**, Soalan Berstruktur, Kertas Soalan Guru
- Pengguna: Senarai Pengguna, Sekolah, Langganan Sekolah, Import Pelajar, Pelajar Komplimen, Import Pengguna, **Penaja**, Anak Angkat, Permohonan Duta, Permohonan Anak Angkat
- SPM: Databank Soalan, Tracking A, **Set Soalan**, **Ramalan SPM**
- Premium: PKSK Soalan, PKSK Akses
- Gamifikasi: Overview, Tier Config, Cabaran, Pelajar, Transaksi, Kedai Hadiah, Gamifikasi Guru, Kawalan Reward, **Hadiah (Katalog)**, **Cabutan**, **Lencana Guru**
- Battle & Permainan: Tetapan Permainan, **Permainan**, Ranking Sekolah, Leaderboard
- Sistem: Log Audit, Tetapan, Chatbot, Push Notifikasi, Upload Screenshot, Performance, Billing Dashboard, Pembayaran, **Billing (invois)**, Dunning Log
- Kandungan/lain: Banner, Artikel, Nota, **Video**, Produk, Penjual, **Laluan Kerjaya, Universiti, Biasiswa**
(Huruf tebal = item yang tidak ada dalam sidebar Blade; Filament tiada Studio, Set Builder, Sumber Kertas, Kertas Subjektif, Kawalan Ciri.)

### 2.3 Sidebar admin V1 (`prestasiplus.my/admin`)

Struktur sama dengan V2 tetapi TANPA: Kawalan Ciri, Bank Soalan (Studio), Import & Semakan, Set Builder, Sumber Kertas, Kertas Subjektif, sub-kumpulan Bank Lama. Perbezaan label: V1 "Push Notifikasi" dan "Upload Screenshot" (V2 "Notifikasi" dan "Screenshots"); V1 menempatkan Duta, Pusat AI dan pintasan pelajar sebagai bahagian berasingan.

- HARIAN: Command Center (LIVE), Aktiviti Harian, Audio KBAT
- ANALITIK: Dashboard, Laporan Eksekutif, Analitik, Monitoring, Kirkpatrick (Overview, T1 Reaksi, ..., Rantaian Impak, Intervensi), Laporan
- Kurikulum: Kurikulum, Subjek, Tahap Pendidikan
- Soalan: **Senarai Soalan, Import CSV, Kualiti Soalan, Laporan Soalan, Soalan Berstruktur, Kertas Soalan Guru**
- Pengguna: Senarai Pengguna, Sekolah, Langganan Sekolah, Import Pelajar, Pelajar Komplimen, Import Pengguna, Penajaan, Anak Angkat, Permohonan
- SPM: Databank Soalan, Latih Tubi, Tracking A, Subjektif
- Premium: PKSK Soalan, PKSK Akses
- Gamifikasi: Overview, Tier Config, Cabaran, Pelajar, Transaksi, Kedai Hadiah, Gamifikasi Guru, Kawalan Reward
- Battle & Permainan: Battle Live, Ranking Sekolah, Leaderboard, Tetapan Permainan
- Marketplace: Produk, Penjual
- Kandungan: Banner, Artikel, Nota, Push Notifikasi, Upload Screenshot
- Kewangan: Pembayaran, Billing Dashboard, Dunning Log
- Sistem: Performance, Tetapan, Log Audit, Chatbot
- Duta: Bilik Duta, Akademi Duta, Permohonan Duta, Duta Dashboard, Jemput Duta, Kem & Bootcamp
- Pusat AI: Kamus AI, Aktiviti Advisor, Pendamping Motivasi, SPM Walkthrough, Whiteboard → Quiz, Parent Whisperer, Doa & Motivasi
- Pintasan pelajar: Profil Cerah, Sekolah Bersaing, Cita-Cita Hijrah, Streak / Kombo, Cikgu Suara, SPM Mock Exam, Wellbeing Alerts, Tetapan Peribadi, Ke Dashboard

## 3. Fungsi sebenar bagi baris dalam senarai pendek

Kunci keputusan: **SAH** = laporan betul; **UBAH** = verdict/cadangan perlu diubah; **TAMBAH** = maklumat baharu yang melengkapkan baris.

| Rujukan laporan | Apa V2 (V1) sebenarnya tunjuk | Keputusan |
|---|---|---|
| ADMIN-PUSAT #2 Dashboard (PP-01) | V2 `/admin` ialah dashboard sebenar (bukan redirect): kad status soalan, Battle Arena, penajaan, 3 Tindakan Pantas, Soalan Terkini, Taburan Status, Pautan Pantas, **Muat Turun Data (CSV): Pengguna, Soalan, Pembayaran, Sekolah**. V1 sama. V3 hanya redirect ke Command Center. | SAH jurang. TAMBAH: eksport CSV 4 set data (users/questions/payments/schools) ialah fungsi sedia ada yang tiada dalam V3. |
| ADMIN-PUSAT #28 Syiling & Token, Gamifikasi Overview | Overview: kad ringkasan (Pelajar Aktif, Syiling Dijana, Token Terkumpul, Penukaran, Cabaran Aktif, Siap Hari Ini), "Taburan Tier" (Gangsa/Perak/Emas/Platinum + "N pelajar belum ditetapkan tier"), "Top 10 Pelajar" (tier, level, syiling). V1 ada tambahan "Transaksi Terkini" (Pelajar, Jenis, Jumlah, Sumber, Masa) + "Lihat semua". | SAH. TAMBAH: V1 ada panel Transaksi Terkini yang tiada pada V2 Overview. |
| ADMIN-PUSAT #29 Tukar Token / Tier Config | `/admin/gamification/tiers`: tajuk "Tier Configuration", nota **"Paparan konfigurasi tier (baca sahaja). Ganjaran Syiling ditetapkan mengikut tier & level soalan."** Setiap tier: urutan, Min Syiling, Kadar Tukar, warna, Latih Tubi syiling/betul l1-l5, PKSK syiling/betul, Papan Bijak syiling/menang. Tiada kawalan edit. | **UBAH**: V2 Tier Config ialah paparan BACA SAHAJA, bukan borang konfigurasi. V3 hanya perlu skrin paparan (atau tiada, jika peraturan ada dalam kod). |
| ADMIN-PUSAT #30 Cabaran Harian | Tajuk "Cabaran Harian", "Urus cabaran harian untuk pelajar". Senarai kad: ikon, nama, kesukaran (Easy/Medium/Hard), status Aktif, deskripsi, jenis (`quiz_count`, `accuracy`, `topic_variety`...), "Sasaran: n", ganjaran syiling + XP, "n sertai / n siap". Tiada butang tambah/sunting dalam pokok. | **UBAH**: paparan baca sahaja (tiada CRUD kelihatan pada Blade). |
| ADMIN-PUSAT #31, #38 Kedai Hadiah (Digital) | V2 Blade: "Kedai Hadiah Digital / Urus catalog hadiah + proses tebusan pelajar"; kad Total Hadiah, Aktif, Tebusan Bulan Ini, Pending Proses; penapis kategori (Semua, ecommerce, ewallet, fnb, gaming, learning, streaming, telco); jadual Katalog Hadiah (Hadiah, Kategori, RM, Token, Stok, Tebusan, Status) dan seksyen **"Tebusan Queue"**. Tiada Tambah/Edit pada Blade V2 (katalog diedit di Filament "Hadiah (Katalog)"). **V1**: tajuk "Admin — Kedai Hadiah Digital", butang **"+ Tambah Hadiah"**, pautan **"Edit"** pada setiap baris, pautan "Tebusan Queue", penapis kategori beremoji (F&B, Streaming, Hiburan, Gaming...), jadual ada lajur Tindakan, paginasi. | **UBAH**: fungsi lengkap = katalog + CRUD hadiah + baris gilir tebusan (proses). V1 menyediakan CRUD terus pada skrin yang sama; V2 memindahkannya ke Filament. |
| ADMIN-PUSAT #35 Kotak Misteri / Kawalan Reward | V2 `/admin/reward-control`: "Kawalan Reward / Kawalan kewangan ekonomi ganjaran": Liabiliti sesi, Pelajar Menebus, Jumlah Tebusan; **Tetapan Kewangan**: Bajet tebus / sesi, Syiling flat / soalan betul, Tahun sesi semasa, "Mini-games beri syiling?" (Tidak = XP sahaja); jadual "Kos Sebenar Hadiah — digital = RM0, tidak makan bajet". V2 tiada kawalan edit pada pokok. **V1** "Kawalan Ekonomi Reward / Tetapan kewangan, kos hadiah & cabutan": medan boleh edit **Bajet tebus / sesi (sen) — RM10 = 1000**, **Sub-had tebus / bulan (sen) — RM3 = 300**, Syiling flat / soalan betul, Tahun sesi semasa, kotak semak "Mini-games beri syiling? (jika tidak: XP sahaja — tutup exploit)", butang **"Simpan Tetapan"**. | **UBAH**: laporan meletakkan #35 sebagai "Kotak Misteri"; sebenarnya modul ini ialah kawalan ekonomi reward (bajet tebus, had bulanan, syiling per betul, mini-games beri syiling). Tiada Kotak Misteri dikenal pasti pada admin V1/V2. Peraturan unik: **sub-had tebus bulanan** hanya ada pada V1. |
| ADMIN-PUSAT #21 Permainan | V2 `/admin/permainan`: "Tetapan Permainan / Urus konfigurasi Papan Bijak, Kad Memori & permainan lain"; kad Jumlah Bilik / Sedang Aktif / Selesai / Pemain Unik; seksyen **Papan Bijak**: medan "Bilangan Petak Soalan" (petak, "Maks 38 petak (48 available - 10 petak khas). Set 0 = tiada soalan."), "Pecahan Papan (50 petak)" (petak soalan, tangga 3 + ular 3, bonus 2 + perangkap 2, petak biasa, mula + tamat); "Senarai Permainan": Papan Bijak (Ular & tangga dengan soalan kuiz, 2-4 pemain), Kad Memori (6 pasangan, 12 kad), Battle Arena (1v1 kuiz masa nyata), masing-masing badge Aktif + pautan "Lihat". V1 sama dan ada butang **"Simpan Tetapan"**; V2 tiada butang Simpan pada pokok Blade (suntingan di Filament "Permainan"/"Tetapan Permainan"). | TAMBAH: spesifikasi lengkap di sebelah. V3 hanya perlu satu parameter (bilangan petak soalan, 0-38) dan paparan senarai permainan. |
| ADMIN-PUSAT #22 Cabutan Bertuah | Hanya di Filament `/admin-filament/lucky-draws` ("Lucky Draws", butang "New lucky draw", lajur Title, Status, Ticket price, Pool, Winner id, Drawn at; keadaan kosong "No lucky draws"). Tiada dalam sidebar Blade V2 atau sidebar V1. | SAH (laporan betul: Filament lucky-draws). TAMBAH: modul ini bukan skrin utama admin, label Filament berbahasa Inggeris. |
| ADMIN-PUSAT #23 Tournament | Tiada skrin "Tournament" dalam sidebar V2/V1 atau Filament. Yang ada: Battle Live `/battle`, Ranking Sekolah, Leaderboard (pautan keluar ke paparan pelajar). | **UBAH**: tiada skrin admin tournament dikenal pasti; baris #23 patut dinyatakan "tiada modul admin berasingan pada V2/V1 (hanya Battle Live/Ranking/Leaderboard + Tetapan Permainan)". |
| ADMIN-PUSAT #33 Papan Pendahulu | Admin V2: pautan Ranking Sekolah dan Leaderboard (`/battle/...`) dan "Top 10 Pelajar" pada Overview Gamifikasi; menu "Gamifikasi > Pelajar" dan "Transaksi" wujud (tidak dibuka). | TAMBAH. |
| ADMIN-PUSAT Jurang #2 Kawalan Ciri | `/admin/feature-toggles` ("Kawalan Ciri / Hidupkan / matikan ciri untuk Pelajar & Guru"). Nota: **"Semua ciri HIDUP secara lalai — item hanya tersembunyi apabila anda mematikannya."** Seksyen **Pelajar (19)**: Zona Permainan, Misi Harian, Kombo, Leaderboard, Remedial, Cita-Cita, Universiti, Biasiswa, Target SPM, Analisa Item, Prestasi, Psikometrik, Profil Cerah, Kemajuan Saya, Sejarah Latihan, Video Pembelajaran, Perutusan, Panduan Pengguna, Tiket Bantuan. Seksyen **Guru (10)**: Headcount, Misi Harian, Kelas, Prestasi, Monitoring, Analisis Item, Gamifikasi, Broadcast, Databank, Sumbang Soalan. Setiap item: butang togol "Matikan ciri" (Aktif) / "Hidupkan ciri" (Off). Tiada dalam V1 sidebar. | SAH (V2 sahaja). TAMBAH: ini ialah pelayan "togol per-peranan" dengan 19 ciri pelajar dan 10 ciri guru. Zona Permainan kelihatan "Off" semasa pemerhatian (keadaan data, bukan fungsi). Perhatikan: item "Remedial", "Misi Harian", "Tiket Bantuan" wujud sebagai ciri boleh togol. |
| ADMIN-PUSAT #4, #42, #43 Analitik, Laporan | V2/V1 `/admin/analytics` "Analitik & Statistik": seksyen Taburan Status Soalan, Kandungan Sokongan, Top 10 Subjek Aktif, **Matriks Liputan Subjek** (lajur D1-D6, T1-T5, Jumlah), Taburan Kesukaran Mengikut Subjek (satu kad setiap subjek). `/admin/laporan` V2 "Laporan / Laporan aktiviti" (V1 "Laporan Statistik"): kad Sekolah, Guru, Murid, Murid Pernah Akses, Cikgu Pernah Akses, Murid Buat Latihan, Jumlah Aktiviti 30 hari, Skor Purata; "Trend Aktiviti (14 hari)", "Pecahan Aktiviti", "Pelajar Paling Aktif (Top 10)", "Cikgu Belum Akses", "Aktiviti Mengikut Sekolah (Top 10)" (V1: "Cikgu Belum Login"). Tiada eksport/borang pada pokok. | SAH jurang. TAMBAH: skop sebenar PM-04/25 ialah **liputan kandungan** (matriks subjek x tahap) dan **laporan penggunaan** (penglibatan murid/guru), bukan analitik prestasi pelajar. |
| ADMIN-PUSAT #1/#3/#45-50 Laporan Eksekutif | `/admin/laporan-eksekutif` "Ringkasan Eksekutif 2026": kad Jumlah Sekolah (sekolah aktif), Pelajar Berdaftar (aktif), Kadar Penglibatan, Soalan Dijawab, Ketepatan, Guru, Soalan/Pelajar Aktif, Bulan Paling Aktif; "Trend Penggunaan Bulanan 2026"; **"Analisis Perbandingan Sekolah"** (Kadar Penglibatan Pelajar %, Ketepatan Akhir %, 5 Sekolah Paling Aktif, Prestasi Mengikut Subjek); **"Headcount TOV → RS (2026)"**; **"GPS Perbandingan Sekolah (2026)"** (jadual Sekolah...). | TAMBAH: satu skrin pusat mencakup Headcount (#3), perbandingan sekolah (#45) dan prestasi subjek. Laporan menyenaraikan 10 baris berasingan; V2 menggabungkannya dalam satu halaman. |
| ADMIN-PUSAT #13 SPM hub | **Hub V2 = 5 kad**: Databank Soalan, **Tracking A** ("Set objektif penuh dan lane bahasa."), Subjektif ("Soalan berstruktur dan esei."), Bijak SPM ("Kertas SPM penuh dalam format sebenar."), Kertas Subjektif (badge **"Flag OFF"**, "Kertas 2, 3 & 4 percubaan negeri."). Setiap kad: nombor + status ("Semua elok" atau amaran, contoh "N set tidak lengkap", "N tiada skema — tidak disajikan"). Teks hub: "Setiap kad di bawah ialah satu laluan yang pelajar boleh buka. Nombor merah menunjukkan berapa banyak item yang perlu diperiksa." Lorong **Latih Tubi wujud** (`/admin/spm/latih-tubi`) tetapi BUKAN kad pada hub. | **UBAH**: laporan menulis "hub 6 lorong" untuk V2; sebenarnya 5 kad. V3 hub (Databank, Subjektif, Bijak SPM, Kertas Subjektif, Latih Tubi) berbeza satu kad: V2 ada **Tracking A** tetapi tiada kad Latih Tubi. Kad "Kertas Subjektif" V2 ada penanda "Flag OFF" (ciri belum dihidupkan untuk pelajar). |
| ADMIN-PUSAT #13, F5 Tracking A | Senarai (`/admin/spm/tracking-a`): "← Semua laluan SPM", "N item · lihat sisi pelajar", penapis Subjek + "Cari", setiap baris "Subjek · 2026 Set N", "#id · ramalan · n soalan", amaran "Hanya n daripada 40 soalan — n tersedia untuk diisi", lencana jenis `ramalan`, pautan **Sunting**. Penyunting set: tajuk "Subjek · 2026 · Set N", "Soalan dalam set n / 40", **"N soalan lagi diperlukan."**, butang **"Isi set"** (isi automatik), senarai soalan bernombor dengan butang **"tukar"** dan **"buang"**, kotak "Soalan tersedia untuk <subjek>:" (kolam calon). Satu set = 40 soalan objektif. | SAH jurang (V3 404). TAMBAH: spesifikasi fungsi Tracking A: set 40 soalan; isi automatik; tukar soalan; buang; amaran set tidak lengkap. |
| ADMIN-PUSAT #13 Latih Tubi (#16) | Lorong admin: "Latih Tubi / N item · lihat sisi pelajar", penapis Subjek, Status, kotak cari ("Teks soalan (3 aksara atau lebih)…"), senarai (teks soalan, "#id · subjek · tahap · n pilihan", lencana status, pautan Sunting `/admin/spm/latih-tubi/{id}/sunting`). Tiada togol ciri pada skrin ini (togol di Kawalan Ciri). | SAH. |
| ADMIN-PUSAT #13 Kertas Subjektif | Lorong `/admin/spm/kertas`: penapis Subjek + Cari ("Teks soalan…"), senarai kertas "Subjek Kertas n — Negeri tahun", "#id · subjek · n halaman", lencana "Terbit". `/admin/kertas-subjektif` ialah skrin berasingan (toggle terbit via POST `/terbit`, ikut `routes/web.php`). | TAMBAH. |
| ADMIN-PUSAT F2/F3 Import & Semakan | `/admin/studio/imports` tajuk "Studio — Import / Kelompok import menunggu semakan" dengan **tiga tab**: **Kelompok Item** (lajur Fail Sumber, Subjek, Bilangan Soalan, Disemak "n / n", Status "Pending review", pautan **Semak**), **Kertas Diimport** (`?tab=kertas`; lajur Kertas, Subjek, Bilangan Soalan, Status "Draft", pautan **"Semak & Terbit"**), **Kiriman Guru** (pautan ke `/admin/question-submissions`). | SAH (laporan betul bahawa tab Kertas Diimport tiada pada V3). TAMBAH: nama tab BM tepat dan lajur. |
| ADMIN-PUSAT F3/F4 Semak kertas (terbit) | `/admin/studio/imports/paper/{id}/review` tajuk "Semak kertas": **amaran halang terbit** ("1 masalah menghalang penerbitan." + senarai, contoh "Soalan 11: Bahagian (i): skema mark_scheme_points kosong."), tajuk kertas, "Subjek · Kertas n · n soalan", lencana **"DRAF — belum diakses pelajar"**, "← Bank", butang **"Terbitkan"** (dilumpuhkan semasa ada masalah), panel **"Isu semasa import (n)"**, kemudian setiap Bahagian (A/B/C) dengan arahan, soalan bernombor, sub-bahagian, markah ("1 markah"), "Ruang jawapan esei". | TAMBAH: peraturan pintu terbit = Terbitkan dilumpuhkan sehingga semua amaran skema selesai. V3 telah ada pintu terbit; ini selaras. |
| ADMIN-PUSAT F4 Set Builder | V2 `/admin/studio/sets` "Set Builder / Kertas latihan daripada bank soalan percubaan": dua borang. **Bina set soalan** ("Ambil soalan daripada kertas percubaan mengikut subjek, tahun dan negeri."): Tajuk set kosong, Subjek, butang **"Mula kosong"**. **Jana set / "Ambil soalan secara rawak"**: Tajuk set (placeholder "cth: Latih Tubi Sejarah Mac"), Subjek, **Soalan (lalai 40)**, butang tahun (2025..2021) dan **butang negeri** (18 pilihan: Johor, ..., MRSM, SABK, SBP, SMKA, WP...) dengan teks "semua jika tiada pilihan"; panel sisi "Kolam soalan" ("Pilih subjek untuk melihat bilangan soalan tersedia.") dan "Set sedia ada". | SAH G-04 (V3 tiada Tahun/Negeri). TAMBAH: penapis Tahun dan Negeri/badan peperiksaan ialah medan sebenar V2; kolam dipaparkan sebaik subjek dipilih (V3 hanya selepas Pratonton). |
| ADMIN-PUSAT #17 Soalan Berstruktur (rubrik) | V2 senarai: penapis (3 combobox + "Cari stimulus..."), tab status **"Semua / Ada rubrik / Skema sahaja / Tiada skema — disembunyikan"**, lajur #, Stimulus, Subjek, Tahap, Aras KBAT, Sub-Soalan, Markah, Pemarkahan, Status. Penyunting `/admin/structured-questions/{id}` "Skema & Rubrik Pemarkahan": nota **"Rubrik di sini yang menentukan pemarkahan automatik. Setiap poin ialah satu isi yang diberi markah (contoh: A1 ...). Jumlah markah bahagian tetap menjadi had — rubrik 5 poin pada bahagian 3 markah bermaksud 'mana-mana 3'."**; medan Stimulus (baca), setiap bahagian: "Skema (ayat penuh)", **"Poin Rubrik"** A1..An (teks "Isi yang diberi markah…" + markah "m"), nota "Kosongkan baris untuk membuang poin itu." Soalan tanpa skema ditandakan "Tiada — disembunyikan" (tidak disajikan kepada pelajar). | **UBAH/TAMBAH**: peraturan penting yang tiada dalam laporan: soalan berstruktur **tanpa skema disembunyikan daripada pelajar**; pemarkahan automatik berasaskan poin rubrik dengan peraturan "mana-mana N" apabila poin lebih daripada markah bahagian. Menyokong cadangan rubrik di PRD. |
| ADMIN-PUSAT #26, #44 Kiriman Guru | V2 `/admin/question-submissions` tajuk "Kertas Soalan Guru / Kiriman kertas soalan daripada guru"; tab Kelompok Item / Kertas Diimport / **Kiriman Guru**; nota **"Kertas yang dihantar guru diproses melalui aliran import Studio (DOCX/OCR → semakan → terbit)."**; kad Jumlah, Pending, Processing, Selesai; penapis status + "Tapis"; lajur Guru / Sekolah, Tajuk, Fail, Status, Tarikh. **V1** sama tetapi ada lajur **Tindakan** dengan butang **"Kemaskini"** (tukar status secara manual) dan pautan muat turun fail pada setiap baris; kandungan baris "Tajuk" ialah subjek + tingkatan + tahun + jenis ("Buku Latihan"). | TAMBAH: V2 tidak lagi ada butang tindakan status (aliran automatik melalui Studio); V1 ada penukaran status manual. Untuk V3, aliran V2 (auto ke Studio) yang menjadi sasaran. |
| Pertanyaan alur soalan: borang cipta soalan | **V2 Studio `/admin/studio/questions/create`**: navigasi borang "Kertas | Rangsangan | Sub-bahagian | Tag"; **Langkah 1 "Kertas & bahagian"** (Kertas pilihan atau "— Soalan bank (tiada kertas) —", Bahagian, Nombor soalan, Teks soalan stem); **Langkah 2 "Rangsangan (stimulus)"** (Jenis rangsangan, Kapsyen, penyunting kaya: Tebal, Condong, Senarai, Blok kod, Jadual, +Baris, +Lajur, Matematik dalam baris/blok, Muat naik imej, Buat asal/semula); **Langkah 3 "Sub-bahagian"** (Label, **Jenis jawapan 14 jenis**: mcq, short_text, numeric, numbered_list, extended_essay, essay_choice, working_shown, graph_plot, draw_on_diagram, table_fill, sequence_order, code, gapped_text_match, cloze; Markah, Arahan sub-bahagian, jawapan diterima; "+ Sub-bahagian", "+ Bahagian utama"); **Langkah 4 "Tag & pengelasan"**: **Bab, Topik, Kesukaran sahaja**. Tiada medan Standard Kandungan / Standard Pembelajaran / TP / Aras pemikiran. **V1 `/admin/questions/create`**: Subjek*, Tahap Pendidikan*, **Bidang, Standard Kandungan, Standard Pembelajaran** (bergantung berturutan, dilumpuhkan sehingga induk dipilih), Tahap Kesukaran* (5 radio Sangat Mudah..Sangat Sukar), Jenis Soalan*, Teks Soalan*, Pilihan A-D (radio jawapan betul), Penjelasan, Bahasa, Nilai Mata, "Simpan Soalan". | **UBAH**: DSKP (Standard Kandungan/Pembelajaran) wujud pada **V1**, BUKAN pada borang Studio V2; V3 (Topik DSKP + SP + TP + Aras) sudah **lebih lengkap daripada V2** dalam pengelasan. Jenis jawapan: V3 patut menyokong sekurang-kurangnya senarai 14 jenis V2 jika PRD mahu setara. |
| Senarai Bank Soalan V2 | `/admin/studio`: "Bank soalan kanonikal — cipta, semak, terbit"; pautan "Bank lama (legasi) →"; butang **"Import DOCX (ZIP)"**, **"Import BI Kertas 1"**, **"+ Cipta baharu"**; 6 penapis (subjek, status Draft/Reviewed/Approved/Archived, tahun, negeri atau badan peperiksaan, kertas, jenis peperiksaan) + "Tapis"; lajur No., Soalan, Kertas, Sumber, Status. | TAMBAH: dua pintu import (DOCX ZIP dan BI Kertas 1) tidak disebut dalam laporan. Status ialah empat peringkat (bukan hanya draf/terbit). |
| ADMIN-PUSAT Sumber Kertas | `/admin/source-papers` "Sumber Kertas / Registri provenance kertas peperiksaan": kad Jumlah Kertas, Perlu Semakan; 5 penapis + kotak semak "Perlu Semakan" + "Tapis"; jadual (Subjek, Tahun, ...). | SAH. |
| ADMIN-PUSAT #41 Import Pengguna | V2 `/admin/users/bulk-import` "Import Pengguna Pukal / Daftarkan guru, ibu bapa, atau pentadbir sekolah secara pukal."; pilih peranan **Guru / Ibu Bapa / Admin**; nota "Import mencipta akaun baharu sahaja — akaun sedia ada tidak ditulis ganti atau dipadam. Fail CSV: `nama,email`. Kata laluan lalai dipaparkan pada skrin."; **notis kelulusan**: "N akaun menunggu kelulusan — belum boleh log masuk." dengan pautan "Semak & luluskan" (`/admin/users?is_active=0`); borang "Borang Import Pengguna" + "Muat Turun CSV Pengguna". | TAMBAH: wujud **aliran kelulusan akaun** (akaun import belum aktif sehingga admin lulus) yang tidak disebut dalam laporan; sidebar V2 memaparkan item Import Pengguna (V3: route ada, tiada menu). |
| ADMIN-PUSAT #54/#6 Kualiti & Laporan Soalan | Hanya di sidebar V1 dan Filament V2 (`/admin/questions/quality`, `/admin/question-reports`); sidebar Blade V2 tidak memaparkannya (di bawah "Bank Lama (Legasi)" mengikut route). Tidak dibuka. | TAMBAH sahaja. |
| ADMIN-PUSAT #7 Video, #15 Penajaan/Anak Angkat, #40 Jemput Ibu Bapa, #37 Chatbot | V2: sidebar Blade ada Penajaan, Anak Angkat, **Permohonan** (anak angkat), Chatbot, Permohonan Duta; Video hanya di Filament; "Jemput Ibu Bapa" (`parent-links`) tiada dalam sidebar V2/V1 (hanya "Jemput Duta"). Halaman tidak dibuka. | **UBAH kecil**: #40 "Jemput Ibu Bapa" tiada menu admin dikenal pasti; yang ada ialah Jemput Duta (pautan pelajar). |
| Menu: pendua Bank Soalan | V2 sendiri mengandungi dua laluan Soalan: Studio (baharu) dan sub-kumpulan "Bank Lama (Legasi)" dengan pautan "Bank lama (legasi) →" pada skrin Studio. | TAMBAH: V2 pun mengekalkan bank lama; "pendua" dalam V3 ada preseden V2. |

## 4. Pembetulan kepada "Cadangan kemaskini PRD"

`ADMIN-PUSAT.md` bahagian 6:

1. **Ubah** nota baris D115 / senarai laluan: tambah bahawa `/admin/feature-toggles` wujud pada V2 dengan 19 ciri pelajar + 10 ciri guru (senarai di bahagian 3); tiada pada V1. Jangan tulis "V2 mempunyai 6 lorong SPM" (hub V2 = 5 kad).
2. **Ubah** "Q-17 / Tracking A": tambah AC fungsi: set 40 soalan, isi automatik, tukar, buang, amaran "n soalan lagi diperlukan", penapis subjek.
3. **Tambah** AC "Semak kertas": butang Terbitkan dilumpuhkan sehingga isu skema kosong diselesaikan (selaras V2).
4. **Ubah** cadangan menu Gamifikasi: Tier Config, Cabaran, Kawalan Reward dan Tetapan Permainan di V2 Blade ialah paparan **baca sahaja**; CRUD hadiah ada pada V1 (Tambah/Edit) dan Filament V2. Cadangan: PRD tetapkan sama ada V3 membina CRUD hadiah + tebusan queue (wajib) dan hanya paparan baca untuk Tier/Cabaran.
5. **Ubah** "Kotak Misteri (#35)" kepada "Kawalan Reward (ekonomi): bajet tebus / sesi, sub-had tebus bulanan, syiling flat per soalan betul, mini-games beri syiling, kos sebenar hadiah" dan tiada skrin Kotak Misteri/Tournament admin pada V1/V2.
6. **Tambah** keperluan dashboard V2: eksport CSV Pengguna / Soalan / Pembayaran / Sekolah.
7. **Tambah** keperluan Laporan: Laporan Eksekutif V2 menggabungkan Headcount TOV → RS, GPS Perbandingan Sekolah, Perbandingan Sekolah (penglibatan, ketepatan akhir) dan Prestasi Mengikut Subjek dalam satu skrin.
8. **Tambah** keperluan Soalan Berstruktur: soalan tanpa skema disembunyikan daripada pelajar; rubrik poin A1..An dengan peraturan "mana-mana N".
9. **Tambah** borang pengelasan: DSKP (Bidang, Standard Kandungan, Standard Pembelajaran) ialah medan V1, bukan V2 Studio; V3 sudah melebihi V2. Tiada keperluan menambah Aras Kesukaran lima radio V1 kerana V3 ada Aras pemikiran.
10. **Tambah** AC Import Pengguna: peranan Guru/Ibu Bapa/Admin, CSV `nama,email`, akaun baharu sahaja, akaun menunggu kelulusan sebelum boleh log masuk (pautan Semak & luluskan).
11. **Pembetulan fakta**: "Panel React admin.prestasiplus.cloud" tidak wujud sebagai tapak langsung (DNS tidak diselesaikan). Panel kedua V2 ialah Filament di `/admin-filament`. Sebarang rujukan PRD kepada panel itu harus mengatakan Filament.
12. **Tambah** nama label V2 tepat: "Kawalan Ciri", "Tetapan Permainan", "Kawalan Reward" (V1: "Kawalan Ekonomi Reward"), "Kedai Hadiah Digital", "Tebusan Queue", "Sumber Kertas", "Kertas Diimport", "Semak & Terbit", "Flag OFF".

`GURU-ADMIN-SEKOLAH.md` / `MURID.md`: tiada halaman guru/murid dilawat (skop admin pusat sahaja dalam senarai pendek kerana semua dibenarkan menggunakan akaun admin; "log masuk sebagai" tidak dilakukan kerana menulis `audit_logs`). Satu kesan sampingan relevan: Kawalan Ciri V2 menyenaraikan ciri guru "Misi Harian", "Headcount", "Sumbang Soalan" dan ciri murid "Remedial", "Tiket Bantuan", sebagai ciri boleh togol; ini menyokong cadangan laporan bahawa `/guru/misi-harian` (404 di V3) ialah ciri sebenar V2 (GURU-ADMIN-SEKOLAH #2) dan Tiket Bantuan murid (MURID A5) ialah ciri V2 boleh dimatikan oleh admin pusat, bukan "tersembunyi" tetap.

## 5. Tidak dapat disahkan (tidak dilawat atau tiada bukti)

- Halaman Gamifikasi Pelajar, Transaksi, Gamifikasi Guru, Tiket, Penajaan, Anak Angkat/Permohonan, Notifikasi, Audit Logs, Chatbot, Billing: hanya wujud dalam sidebar, kandungan tidak dibuka.
- Skrin edit Filament (Hadiah Katalog, Permainan, Lencana Guru): hanya senarai Cabutan dibuka.
- Sama ada skrin baca sahaja Blade V2 sememangnya tiada kawalan edit atau kawalan tidak dipaparkan dalam pokok kebolehcapaian (tiada butang Simpan dikesan; V1 jelas ada "Simpan Tetapan").
- Kawalan Ciri pada V1: tiada dalam sidebar, URL tidak diprob.
- Skrin Studio selepas tindakan (Hantar semakan, Terbit, Arkib) tidak dijalankan (hanya baca).
- Peraturan dalaman (contoh amaran "Flag OFF" mengawal apa tepatnya).
