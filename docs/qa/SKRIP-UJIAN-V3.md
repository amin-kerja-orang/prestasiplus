# Skrip Ujian Manual V3 (semakan tempatan)

Skrip ini untuk pemilik produk menyemak V3 dengan tangan di pelayar. Ia akan bertambah mengikut portal (Admin Pusat dahulu).

## Cara guna

1. Buka pelayar dan pergi ke `http://localhost:5194`.
2. Log masuk dengan akaun dalam `AKAUN-DEMO-V3-LOCAL.md` (di akar repo). Untuk Bahagian 1 guna akaun admin pusat: `admin@demo.test`. Kata laluan demo bersama: `Demo1234`.
3. Ikut kes ujian satu demi satu. Tanda `Keputusan` dan tulis `Komen` jika ada masalah.
4. Semua data contoh dalam skrip ini rekaan. Jangan padam rekod sedia ada (data demo dikongsi).
5. Cuba juga skrin pada lebar telefon (375 px) dan tablet (768 px): tiada skrol ke tepi, menu boleh dicapai.

### Petunjuk keadaan di V3 (jadual liputan)

| Kod | Maksud |
|---|---|
| Berfungsi | Skrin dibuka dengan kandungan sebenar dan ada kes ujian. |
| Separa | Skrin ada tetapi ada bahagian V2 yang tiada, atau tiada dalam menu sisi (hanya boleh dibuka melalui URL). |
| Tiada | Halaman 404 "Halaman Tidak Dijumpai" atau tiada pautan. Belum dibina di V3. |
| Ditangguh | Sengaja ditangguhkan (keputusan D118). Tidak perlu diuji sekarang. |

### Petunjuk keputusan

`☐ Lulus` = sama seperti jangkaan. `☐ Gagal` = tidak sama; tulis apa yang dilihat dalam `Komen`.

Nota: pemerhatian "Keadaan di V3" direkod pada 9 Nov 2026 dengan akaun admin demo. Pada data demo, banyak senarai kosong atau kecil; ini bukan ralat.

---

# Bahagian 1: Admin Pusat (aliran V2 admin)

Sumber V2: sidebar admin `prestasiplus.cloud/admin` dan panel Filament `prestasiplus.cloud/admin-filament`. Nama `admin.prestasiplus.cloud` tidak wujud (DNS tidak diselesaikan), jadi tiada panel ketiga. Item yang sama pada kedua-dua panel digabung satu baris.

## 1.1 Jadual liputan

Semua URL V3 bermula dengan `http://localhost:5194`.

### Harian dan Analitik

| No | Menu V2 (URL V2) | Menu V3 | URL V3 | Keadaan di V3 | Kes ujian |
|---|---|---|---|---|---|
| 1 | Command Center (`/admin/command-center`) | Command Center (atas) | `/admin/command-center` | Berfungsi: kad sekolah, pelajar, soalan dijawab, ketepatan | ADM-01 |
| 2 | Aktiviti Harian (`/admin/command-center/daily-activity`) | Aktiviti Harian (atas) | `/admin/command-center/daily-activity` | Berfungsi: tab Hari Ini / Minggu Ini / Bulan Ini | ADM-02 |
| 3 | Audio KBAT (`/admin/audio-kbat`) | Audio KBAT (atas) | `/admin/audio-kbat` | Berfungsi: senarai set, penapis, Cipta Set, templat | ADM-03 |
| 4 | Dashboard (`/admin`) | Harian > Dashboard | `/admin` | Separa: kad, Tindakan Pantas, Taburan Status ada; **Muat Turun Data (CSV) tiada**; "Soalan Terkini" tiada | ADM-04 |
| 5 | Laporan Eksekutif (`/admin/laporan-eksekutif`) | (tiada) | `/admin/laporan-eksekutif` | Tiada: 404 | - |
| 6 | Analitik (`/admin/analytics`) | Analitik > Analitik | `/admin/analytics` | Berfungsi | ADM-05 |
| 7 | Monitoring (`/admin/monitoring`) | Analitik > Monitoring | `/admin/monitoring` | Berfungsi: penapis tempoh, negeri, tahap | ADM-06 |
| 8 | Kirkpatrick (Overview, T1-T4, Rantaian Impak, Intervensi) | Analitik > Kirkpatrick | `/admin/kirkpatrick` (+ `/reaction`, `/learning`, `/behavior`, `/results`, `/chain`, `/interventions`) | Berfungsi: 7 halaman dengan tab | ADM-07 |
| 9 | Laporan (`/admin/laporan`) | Analitik > Laporan | `/admin/laporan` | Berfungsi: kad, trend 14 hari | ADM-08 |

### Kurikulum

| No | Menu V2 (URL V2) | Menu V3 | URL V3 | Keadaan di V3 | Kes ujian |
|---|---|---|---|---|---|
| 10 | Kurikulum + Bab (`/admin/curriculum`) | Kurikulum > Kurikulum | `/admin/curriculum` | Berfungsi: tab Bab / DSKP, penapis subjek dan tahap | ADM-09 |
| 11 | Subjek (`/admin/subjects`) | Kurikulum > Subjek | `/admin/subjects` | Berfungsi: Tambah, Edit, togol Aktif | ADM-10 |
| 12 | Tahap Pendidikan (`/admin/education-levels`) | Kurikulum > Tahap Pendidikan | `/admin/education-levels` | Berfungsi | ADM-11 |

### Soalan

| No | Menu V2 (URL V2) | Menu V3 | URL V3 | Keadaan di V3 | Kes ujian |
|---|---|---|---|---|---|
| 13 | SPM hub (`/admin/spm`) | Soalan > SPM | `/admin/spm` | Berfungsi: 6 kad (Databank, Tracking A, Subjektif, Bijak SPM, Kertas Subjektif, Latih Tubi) | ADM-12 |
| 14 | Bank Soalan Studio (`/admin/studio`) | Soalan > Bank Soalan (Studio) | `/admin/studio` | Berfungsi: penapis, Cipta baharu, Pratonton, Edit, Sembunyikan | ADM-13 |
| 15 | Import & Semakan (`/admin/studio/imports`) | Soalan > Import & Semakan | `/admin/spm/soalan/ekstrak` (URL V2 dialihkan ke sini) | Separa: tab Kelompok Item dan Kiriman Guru ada; **tab "Kertas Diimport" tiada**; ada butang Muat Naik Kertas, Tulis Soalan Manual, Import CSV | ADM-14 |
| 16 | Set Builder (`/admin/studio/sets`) | Soalan > Set Builder | `/admin/studio/sets` | Separa: Mula kosong, Jana set, kolam soalan, set sedia ada ada; **butang Tahun dan Negeri tiada** | ADM-15 |
| 17 | Sumber Kertas (`/admin/source-papers`) | Soalan > Sumber Kertas | `/admin/source-papers` | Berfungsi | ADM-16 |
| 18 | Kertas Subjektif (`/admin/kertas-subjektif`, `/admin/spm/kertas`) | Soalan > Kertas Subjektif | `/admin/kertas-subjektif` | Berfungsi (0 kertas pada data demo) | ADM-17 |
| 19 | Senarai Soalan, bank lama (`/admin/questions`) | Soalan > Bank Lama > Senarai Soalan | `/admin/questions` | Berfungsi: cari, penapis, Luluskan, Arkib | ADM-18 |
| 20 | Soalan Berstruktur (`/admin/structured-questions`) | Soalan > Bank Lama > Soalan Berstruktur | `/admin/structured-questions` | Berfungsi: senarai 18 soalan, Lihat, Tambah | ADM-19 |
| 21 | Kiriman Guru (`/admin/question-submissions`) | Pautan tab dalam Import & Semakan | `/admin/question-submissions` | Berfungsi (tiada dalam sidebar) | ADM-20 |
| 22 | Kualiti Soalan dan Laporan Soalan (`/admin/questions/quality`, `/admin/question-reports`) | Tab "Kualiti" / "Laporan" dalam Senarai Soalan | `/admin/questions/quality`, `/admin/question-reports` | Berfungsi (tiada dalam sidebar) | ADM-21 |
| 23 | Import CSV Soalan (`/admin/questions/import`) | Butang "Import CSV" dalam Senarai Soalan | `/admin/questions/import`, `/admin/questions/import-history` | Berfungsi | ADM-22 |
| 24 | Tracking A (`/admin/spm/tracking-a`) | Kad pada SPM hub | `/admin/spm/tracking-a` | Berfungsi: 10 set, Sunting, Tambah Set | ADM-23 |
| 25 | Latih Tubi (`/admin/spm/latih-tubi`) | Kad pada SPM hub | `/admin/spm/latih-tubi` | Berfungsi | ADM-24 |
| 26 | Databank Soalan SPM (`/spm/tahun-lepas`, panel `/admin/spm`) | Pengguna/SPM > Databank Soalan | `/admin/spm/databank` | Berfungsi | ADM-25 |

### Pengguna

| No | Menu V2 (URL V2) | Menu V3 | URL V3 | Keadaan di V3 | Kes ujian |
|---|---|---|---|---|---|
| 27 | Senarai Pengguna (`/admin/users`) | Pengguna > Senarai Pengguna | `/admin/users` | Berfungsi: cari, penapis, Tambah, Edit, notis akaun menunggu kelulusan | ADM-26 |
| 28 | Sekolah (`/admin/schools`) | Pengguna > Sekolah | `/admin/schools` | Berfungsi | ADM-27 |
| 29 | Langganan Sekolah (`/admin/school-subscriptions`) | Pengguna > Langganan Sekolah | `/admin/school-subscriptions` | Berfungsi (0 langganan pada data demo) | ADM-28 |
| 30 | Import Pelajar (`/admin/import-students`) | Pengguna > Import Pelajar | `/admin/import-students` | Berfungsi | ADM-29 |
| 31 | Pelajar Komplimen (`/admin/comp-students`) | Pengguna > Pelajar Komplimen | `/admin/comp-students` | Berfungsi (kosong pada data demo) | ADM-30 |
| 32 | Import Pengguna (`/admin/users/bulk-import`) | Pengguna > Import Pengguna | `/admin/users/bulk-import` | Berfungsi: peranan Guru, Ibu Bapa, Admin dan PPD | ADM-31 |
| 33 | Penajaan (`/admin/sponsors`) | (tiada) | `/admin/sponsors` | Tiada: 404 | - |
| 34 | Anak Angkat (`/admin/anak-angkat`) | (tiada) | `/admin/anak-angkat` | Tiada: 404 | - |
| 35 | Permohonan Anak Angkat (`/admin/anak-angkat/permohonan`) | (tiada) | `/admin/anak-angkat/permohonan` | Tiada: 404 | - |

### Premium dan Sistem (Kawalan Ciri)

| No | Menu V2 (URL V2) | Menu V3 | URL V3 | Keadaan di V3 | Kes ujian |
|---|---|---|---|---|---|
| 36 | PKSK Soalan (`/admin/pksk/questions`) | Premium > PKSK Soalan | `/admin/pksk/questions` | Berfungsi (0 soalan pada data demo; borang Tambah ada) | ADM-32 |
| 37 | PKSK Akses (`/admin/pksk/access`) | Premium > PKSK Akses | `/admin/pksk/access` | Berfungsi | ADM-33 |
| 38 | Kawalan Ciri (`/admin/feature-toggles`) | Sistem > Kawalan Ciri | `/admin/feature-toggles` | Berfungsi: ciri Pelajar dan Guru, togol Aktif/Off | ADM-34 |

### Gamifikasi

| No | Menu V2 (URL V2) | Menu V3 | URL V3 | Keadaan di V3 | Kes ujian |
|---|---|---|---|---|---|
| 39 | Gamifikasi Overview (`/admin/gamification`) | (tiada) | `/admin/gamification` | Tiada: 404 | - |
| 40 | Tier Config, baca sahaja (`/admin/gamification/tiers`) | (tiada) | `/admin/gamification/tiers` | Tiada: 404 (D118: akan jadi skrin baca sahaja, belum dibina) | - |
| 41 | Cabaran Harian, baca sahaja (`/admin/gamification/challenges`) | (tiada) | `/admin/gamification/challenges` | Tiada: 404 (D118: baca sahaja, belum dibina) | - |
| 42 | Gamifikasi Pelajar | (tiada) | `/admin/gamification/students` | Tiada: 404 | - |
| 43 | Gamifikasi Transaksi | (tiada) | `/admin/gamification/transactions` | Tiada: 404 | - |
| 44 | Kedai Hadiah Digital + Hadiah Katalog (`/admin/hadiah`) | **Tiada dalam menu sisi** | `/admin/hadiah`, `/admin/hadiah/baharu`, `/admin/hadiah/tebusan` | Separa: skrin berfungsi (katalog, Tambah Hadiah, Edit, Tebusan Queue) tetapi hanya boleh dibuka melalui URL | ADM-35, ADM-36 |
| 45 | Gamifikasi Guru (`/admin/gamifikasi/guru`) | (tiada) | `/admin/gamifikasi/guru` | Tiada: 404 | - |
| 46 | Kawalan Reward (`/admin/reward-control`) | (tiada) | `/admin/reward-control` | Tiada: 404 | - |
| 47 | Cabutan / Lucky Draws (Filament `/admin-filament/lucky-draws`) | (tiada) | `/admin/lucky-draws` | Tiada: 404 | - |
| 48 | Lencana Guru (Filament) | (tiada) | `/admin/lencana-guru` | Tiada: 404 | - |

### Battle dan Permainan, Marketplace

| No | Menu V2 (URL V2) | Menu V3 | URL V3 | Keadaan di V3 | Kes ujian |
|---|---|---|---|---|---|
| 49 | Battle Live (`/battle`) dan Leaderboard (`/battle/...`) | (tiada dalam sidebar admin; skrin pelajar) | `/battle`, `/battle/leaderboard` | Berfungsi (skrin pelajar boleh dibuka oleh admin); leaderboard kosong "Belum ada data ranking" | ADM-37 |
| 50 | Ranking Sekolah | (tiada) | `/battle/ranking`, `/battle/school-ranking` | Tiada: 404 (URL tepat V2 tidak diketahui) | - |
| 51 | Tetapan Permainan (`/admin/permainan`) | **Tiada dalam menu sisi** | `/admin/permainan` | Separa: skrin berfungsi tetapi hanya melalui URL | ADM-38 |
| 52 | Marketplace > Produk | Marketplace > Produk | `/admin/marketplace/products` | Berfungsi | ADM-39 |
| 53 | Marketplace > Penjual | Marketplace > Penjual | `/admin/marketplace/sellers` | Berfungsi | ADM-40 |

### Kandungan

| No | Menu V2 (URL V2) | Menu V3 | URL V3 | Keadaan di V3 | Kes ujian |
|---|---|---|---|---|---|
| 54 | Artikel | Kandungan > Artikel | `/admin/articles` | Berfungsi | ADM-41 |
| 55 | Banner | Kandungan > Banner | `/admin/banners` | Berfungsi | ADM-42 |
| 56 | Nota | Kandungan > Nota | `/admin/notes` | Berfungsi (0 nota pada data demo) | ADM-43 |
| 57 | Notifikasi (`/admin/notifications`) | (tiada) | `/admin/notifications` | Tiada: 404 | - |
| 58 | Screenshots (`/admin/tools/screenshots`) | Kandungan > Upload Screenshot | `/admin/tools/screenshots` | Berfungsi | ADM-44 |
| 59 | Video (Filament) | Kandungan > Video | `/admin/videos` | Berfungsi | ADM-45 |
| 60 | Laluan Kerjaya, Universiti, Biasiswa (Filament) | (tiada) | `/admin/kerjaya`, `/admin/universities`, `/admin/biasiswa` | Tiada: 404 | - |

### Kewangan, Sistem, Duta, Pusat AI

| No | Menu V2 (URL V2) | Menu V3 | URL V3 | Keadaan di V3 | Kes ujian |
|---|---|---|---|---|---|
| 61 | Pembayaran | (tiada) | `/admin/payments` | Tiada: 404 | - |
| 62 | Billing (`/admin/billing`, invois) | (tiada) | `/admin/billing` | Tiada: 404 | - |
| 63 | Dunning (`/admin/dunning`) | (tiada) | `/admin/dunning` | Tiada: 404 | - |
| 64 | Tetapan (`/admin/settings`) | Sistem > Tetapan | `/admin/settings` | Berfungsi: 3 medan Hubungi Sokongan | ADM-46 |
| 65 | Prestasi Sistem (`/admin/performance`) | (tiada) | `/admin/performance` | Tiada: 404 | - |
| 66 | Audit Logs (`/admin/audit-logs`) | (tiada) | `/admin/audit-logs` | Tiada: 404 | - |
| 67 | Chatbot (`/admin/chatbot`) | (tiada) | `/admin/chatbot` | Tiada: 404 | - |
| 68 | Duta: Permohonan Duta, Bilik Duta, Kem & Bootcamp, Akademi Duta, Dashboard Duta, Jemput Duta | (tiada) | `/admin/duta-applications`, `/admin/permohonan-duta`, `/admin/duta` | Tiada: 404 | - |
| 69 | Pusat AI: Kamus AI, SPM Walkthrough, Aktiviti Advisor, Pendamping Motivasi, Whiteboard ke Quiz, Parent Whisperer, Doa & Motivasi | (tiada) | `/admin/kamus-ai` (contoh) | Tiada: 404 | - |

### Ditangguhkan (keputusan D118)

| No | Menu V2 | Menu V3 | URL V3 | Keadaan di V3 | Kes ujian |
|---|---|---|---|---|---|
| 70 | Tournament / Liga (tiada skrin admin di V2) | (tiada) | - | Ditangguh | - |
| 71 | Jemput Ibu Bapa (tiada skrin admin di V2) | (tiada) | - | Ditangguh | - |
| 72 | Kotak Misteri (tiada skrin admin di V2; bahagian Kawalan Reward) | (tiada) | - | Ditangguh | - |

### Tambahan yang hanya ada di V3 (bukan menu admin V2)

| No | Menu V3 | URL V3 | Keadaan di V3 | Kes ujian |
|---|---|---|---|---|
| T1 | Sistem > Tiket Bantuan | `/admin/tiket` | Berfungsi: tapis peranan, tab status | ADM-47 |
| T2 | Pengguna > Kelas Sekolah | `/admin/classes` | Berfungsi | ADM-48 |
| T3 | Soalan > Audit Rajah | `/admin/soalan-gambar` | Berfungsi (0 pada data demo) | (lihat sahaja) |

### Ringkasan liputan

| Perkara | Bilangan |
|---|---|
| Aliran V2 (baris 1-72) | 72 |
| Berfungsi di V3 | 40 |
| Separa (ada tetapi kurang, atau tiada dalam menu sisi) | 5 (baris 4, 15, 16, 44, 51) |
| Tiada (404) | 24 |
| Ditangguh (D118) | 3 |
| Kes ujian (blok ADM-xx.x) | 58 |

---

## 1.2 Kes ujian

Semua kes guna akaun **Admin Pusat** (`admin@demo.test`, kata laluan `Demo1234`) melainkan dinyatakan. Prasyarat umum: sudah log masuk.

### Harian

**ADM-01.1 Command Center dibuka**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah:
  1. Pada menu kiri, klik **Command Center** (ada lencana LIVE).
  2. Lihat kad di bahagian atas.
  3. Klik nama sekolah dalam senarai (contoh "SMK Demo Satu").
- Jangkaan: kad Sekolah Berdaftar, Pelajar Berdaftar, Soalan Dijawab dan Ketepatan Purata dipaparkan. Klik sekolah membuka butiran sekolah itu (kelas, guru), dengan pautan kembali.
- Rujukan: V2 `/admin/command-center`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-02.1 Aktiviti Harian**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah:
  1. Klik **Aktiviti Harian**.
  2. Klik tab **Minggu Ini**, kemudian **Bulan Ini**, kemudian **Hari Ini**.
- Jangkaan: angka Soalan Dijawab, Pelajar Aktif, Sekolah Aktif, Sesi Latihan dan Login Hari Ini berubah mengikut tab. Tiada ralat.
- Rujukan: V2 `/admin/command-center/daily-activity`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-03.1 Audio KBAT: senarai dan penapis**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah:
  1. Klik **Audio KBAT**.
  2. Pilih Tahap **Tingkatan 4**, kemudian klik **Tapis**.
  3. Taip satu perkataan dalam kotak **Cari**, klik **Tapis**.
- Jangkaan: senarai set audio ditapis; jika tiada padanan, keadaan kosong dipaparkan.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-03.2 Audio KBAT: templat dan borang Cipta Set**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah:
  1. Pada halaman Audio KBAT, klik **Template XLSX**, kemudian **Template Word**.
  2. Klik **Cipta Set**.
- Jangkaan: kedua-dua templat dimuat turun sebagai fail. Borang Cipta Set dibuka dengan medan set audio. Jangan simpan jika tidak perlu.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

### Analitik

**ADM-04.1 Dashboard memaparkan kad ringkasan**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah:
  1. Klik **Dashboard** (bawah Harian) atau pergi ke `/admin`.
  2. Lihat kad: Soalan Aktif, Diluluskan, Menunggu Semakan, Draf, Subjek, Tahap Pendidikan, Pengguna, Battle Arena.
  3. Klik **Tambah Soalan Baru**, kembali; klik **Tambah Subjek Baru**, kembali; klik **Import & Semakan Soalan**.
  4. Klik pautan Kurikulum, Banner dan Artikel dalam Pautan Pantas.
- Jangkaan: setiap Tindakan Pantas dan Pautan Pantas membuka skrin yang betul. "Taburan Status Soalan" memaparkan Draf, Menunggu Semakan, Diluluskan, Diarkibkan.
- Rujukan: V2 `/admin`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-04.2 Dashboard: Muat Turun Data (CSV)**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah:
  1. Pada `/admin`, skrol ke bawah mencari bahagian **Muat Turun Data (CSV)**.
  2. Cuba muat turun Pengguna, Soalan, Pembayaran dan Sekolah.
- Jangkaan (sasaran V3): empat butang muat turun CSV. **Keadaan semasa: bahagian ini tiada pada skrin** (belum dibina). Rekod sebagai Gagal selagi tiada.
- Rujukan: V2 `/admin` (keputusan D118 untuk dibina).
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-05.1 Analitik**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Klik **Analitik**. 2. Skrol seluruh halaman.
- Jangkaan: kad Sekolah, Pelajar, Soalan Dijawab, Ketepatan; Taburan Status Soalan; liputan DSKP. Tiada ralat atau skrol ke tepi.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-06.1 Monitoring dengan penapis**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah:
  1. Klik **Monitoring**.
  2. Pilih Tempoh **7 Hari**, kemudian **Semua Masa**.
  3. Pilih Negeri **Selangor**, kemudian Tahap **Cemerlang**.
- Jangkaan: senarai/ jadual dikemas kini mengikut penapis; pilih "Semua" memulihkan senarai.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-07.1 Kirkpatrick: semua tab**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah:
  1. Klik **Kirkpatrick** (halaman Overview).
  2. Klik tab satu demi satu: **T1: Reaksi, T2: Pembelajaran, T3: Tingkah Laku, T4: Hasil, Rantaian Impak, Intervensi**.
  3. Pada Overview, tukar penapis Sekolah kepada satu sekolah demo.
  4. Pada Rantaian Impak, klik **Muat Turun Laporan**.
- Jangkaan: setiap tab dibuka tanpa ralat; angka kosong/0 pada data demo adalah biasa. Penapis sekolah mengubah paparan. Muat turun laporan menghasilkan fail PDF.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-08.1 Laporan aktiviti**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Klik **Laporan**. 2. Skrol seluruh halaman.
- Jangkaan: kad Sekolah, Guru, Murid, Murid Pernah Akses, Cikgu Pernah Akses, Murid Buat Latihan, Jumlah Aktiviti 30 hari, Skor Purata; Trend Aktiviti (14 hari); senarai Pelajar Paling Aktif dan Cikgu Belum Akses.
- Rujukan: V2 `/admin/laporan`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

### Kurikulum

**ADM-09.1 Kurikulum: Bab dan DSKP**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah:
  1. Klik **Kurikulum**.
  2. Pilih Subjek **Matematik** dan Tahap **Tingkatan 4**, klik **Tapis**.
  3. Klik tab **DSKP**, kemudian kembali ke tab **Bab**.
- Jangkaan: senarai bab dan topik untuk subjek dan tahap itu dipaparkan. Pautan tambah/ edit bab dan topik boleh dibuka (jangan simpan).
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-10.1 Subjek: lihat, tambah (buka borang), togol aktif**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah:
  1. Klik **Subjek**. Lihat kad jumlah (Jumlah Subjek, Aktif, Teras, Jumlah Soalan).
  2. Klik **Tambah**, lihat borang, kemudian klik kembali tanpa simpan.
  3. Klik **Edit** pada satu subjek, tukar nama BM kepada "Subjek Contoh Ujian", simpan. Kemudian ubah semula nama asal.
- Jangkaan: borang simpan berjaya dengan mesej; jadual menunjukkan nama baharu, kemudian nama asal selepas dipulihkan.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-11.1 Tahap Pendidikan**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Klik **Tahap Pendidikan**. 2. Klik **Tambah Tahap** (lihat borang, jangan simpan). 3. Klik **Edit** pada Tingkatan 1 dan kembali.
- Jangkaan: lima tahap dipaparkan dengan kod, peringkat dan kurikulum (KSSM). Borang tambah/edit dibuka tanpa ralat.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

### Soalan

**ADM-12.1 Hub SPM**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah:
  1. Klik **SPM** (bawah Soalan).
  2. Baca enam kad: Databank Soalan, Tracking A, Subjektif, Bijak SPM, Kertas Subjektif, Latih Tubi.
  3. Klik **Buka senarai** pada setiap kad, kembali dengan pautan "Semua laluan SPM".
  4. Klik **lihat sisi pelajar** pada satu kad.
- Jangkaan: setiap kad ada nombor dan status ("Semua elok" atau bilangan item yang perlu diperiksa). Setiap pautan membuka skrin betul. "lihat sisi pelajar" membuka paparan murid.
- Rujukan: V2 `/admin/spm` (V3 tambah kad Latih Tubi, keputusan D118).
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-13.1 Bank Soalan Studio: cari dan tapis**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah:
  1. Klik **Bank Soalan (Studio)**.
  2. Klik pautan status **Draf** (kad atas), kemudian **Diterbitkan**.
  3. Pilih Subjek **Matematik**, status **Diterbitkan**, klik **Tapis**.
  4. Tukar "25 / halaman" dan klik halaman 2.
- Jangkaan: senarai ditapis mengikut pilihan; jumlah kad dan paginasi betul.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-13.2 Bank Soalan Studio: pratonton dan borang cipta**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah:
  1. Pada satu soalan, klik **Pratonton**, kemudian tutup.
  2. Klik **Cipta baharu**.
  3. Lihat langkah borang (kertas dan bahagian, rangsangan, sub-bahagian, tag). Taip teks soalan contoh "Apakah ibu negara Malaysia?" tetapi jangan simpan, klik kembali.
- Jangkaan: pratonton memaparkan soalan; borang cipta dibuka dengan semua langkah dan jenis jawapan.
- Rujukan: V2 `/admin/studio/questions/create`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-14.1 Import & Semakan: kelompok item**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah:
  1. Klik **Import & Semakan**.
  2. Lihat tab **Kelompok Item**; tapis status **Selesai** dan subjek **Matematik**, klik **Cari**.
  3. Klik **Semak** pada satu kelompok.
  4. Kembali, klik tab **Kiriman Guru**.
  5. Cari tab **Kertas Diimport**.
- Jangkaan: jadual kelompok dengan Fail Sumber, Subjek, Bilangan Soalan, Disemak, Status. Semak membuka skrin semakan. Tab Kiriman Guru membuka senarai kiriman. **Tab Kertas Diimport tiada** (belum dibina); rekod sebagai Gagal selagi tiada.
- Rujukan: V2 `/admin/studio/imports` (tiga tab).
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-14.2 Import & Semakan: pintu masuk import**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Pada halaman Import & Semakan klik **Muat Naik Kertas**. 2. Kembali, klik **Tulis Soalan Manual**. 3. Kembali, klik **Import CSV**.
- Jangkaan: setiap butang membuka skrin masing-masing tanpa ralat (jangan muat naik fail sebenar).
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-15.1 Set Builder: set sedia ada**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah:
  1. Klik **Set Builder**.
  2. Baca senarai "Set sedia ada" (contoh "Latihan Demo Matematik").
  3. Klik **Buka** pada satu set, kembali; klik **Semak** pada set yang sama.
- Jangkaan: setiap set memaparkan subjek, kertas, bilangan soalan, markah, status (Draf/Diterbitkan) dan siapa yang melihat (Dilihat murid). Buka dan Semak berfungsi.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-15.2 Set Builder: bina set kosong dan jana set**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah:
  1. Pada borang "Bina set soalan", taip Tajuk set kosong `Set Contoh Ujian 1`, pilih Subjek **Sains**, Kertas, "Dilihat murid" **Tingkatan 4**. Klik **Mula kosong**.
  2. Kembali ke Set Builder. Pada borang "Jana set", pilih Subjek **Matematik** dan lihat bilangan "Kolam soalan".
  3. Cari butang **Tahun** dan **Negeri**.
- Jangkaan: set kosong baharu muncul dalam "Set sedia ada" (boleh disalin atau dipadam kemudian, hanya padam set contoh ini). Kolam soalan memaparkan bilangan. **Butang pilihan Tahun dan Negeri tiada** pada V3 (V2 ada); rekod sebagai Gagal jika dikehendaki.
- Rujukan: V2 `/admin/studio/sets`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-16.1 Sumber Kertas**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Klik **Sumber Kertas**. 2. Tapis Subjek, Tahun 2026, kemudian pilih Kertas 1. 3. Klik satu baris.
- Jangkaan: kad Jumlah Kertas dan Perlu Semakan; jadual ditapis; butiran kertas dibuka.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-17.1 Kertas Subjektif**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Klik **Kertas Subjektif**. 2. Tukar penapis Subjek, Kertas (2/3/4) dan Status (Terbit/Draf), klik **Tapis**. 3. Klik **Baharu** (lihat borang, jangan simpan).
- Jangkaan: kad Jumlah Kertas, Diterbitkan, Ada Skema; senarai kosong dengan mesej jelas jika tiada kertas. Borang Baharu dibuka.
- Rujukan: V2 `/admin/spm/kertas`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-18.1 Senarai Soalan (bank lama)**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah:
  1. Klik **Senarai Soalan** (bawah Bank Lama).
  2. Baca nota "bank soalan lama" dan pautan ke Bank Soalan (Studio).
  3. Pilih Subjek, Tahap dan Status, klik **Cari**.
  4. Klik **Lihat** pada satu soalan, kembali, klik **Edit**, kembali tanpa simpan.
  5. Tanda dua soalan dengan kotak semak, lihat butang tindakan pukal.
- Jangkaan: senarai, penapis dan paginasi berfungsi. Lihat dan Edit membuka butiran. Jangan tekan "Arkib Semua" atau "Luluskan Hasil Tapisan" pada data demo.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-19.1 Soalan Berstruktur**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Klik **Soalan Berstruktur**. 2. Pilih Subjek **Matematik Tambahan**, klik **Cari**. 3. Klik **Lihat** pada satu soalan. 4. Klik **Tambah Soalan** (jangan simpan).
- Jangkaan: kad jumlah dan agihan mengikut subjek; jadual ada Stimulus, Subjek, Tingkatan, KBAT, Markah, Sub-Q. Butiran memaparkan bahagian dan skema.
- Rujukan: V2 `/admin/structured-questions`. Nota: peraturan V2 "soalan tanpa skema disembunyikan daripada pelajar" boleh disemak di butiran.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-20.1 Kiriman Guru**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Buka `http://localhost:5194/admin/question-submissions` (atau tab Kiriman Guru dalam Import & Semakan). 2. Pilih Status **Pending**, klik **Tapis**.
- Jangkaan: kad Jumlah, Pending, Processing, Selesai; jadual Guru/Sekolah, Tajuk, Fail, Status, Tarikh, Tindakan.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-21.1 Kualiti Soalan dan Laporan Soalan**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Buka **Senarai Soalan**, klik tab **Kualiti**. 2. Klik tab **Laporan**. 3. Pada Laporan klik tab status **Menunggu**, kemudian **Semua**.
- Jangkaan: Kualiti memaparkan jumlah soalan, purata skor, bucket skor dan butang "Jalankan Audit Semula". Laporan memaparkan laporan soalan daripada murid dengan status Menunggu/Disemak/Diperbaiki/Ditolak.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-22.1 Import CSV soalan**
- Akaun: Admin Pusat. Prasyarat: fail `soalan-contoh.csv` rekaan dengan satu baris soalan (sediakan sendiri).
- Langkah: 1. Buka **Senarai Soalan** dan klik **Import CSV**. 2. Pilih Subjek Lalai. 3. Pilih fail CSV (maks 5MB). 4. Hantar. 5. Klik **Sejarah Import**.
- Jangkaan: ringkasan berjaya/gagal dipaparkan. Sejarah Import menyenaraikan tarikh, fail, bilangan diimport dan gagal. Soalan baharu masuk sebagai Draf; padam atau arkibkan rekod ujian itu.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-23.1 Tracking A: senarai dan penyunting**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Daripada hub SPM klik **Buka senarai** pada kad Tracking A. 2. Tapis Subjek **Sains**, klik **Tapis**. 3. Klik **Sunting** pada satu set. 4. Cari butang isi set, tukar dan buang soalan (jangan sahkan jika tidak mahu mengubah data). 5. Klik **Tambah Set** (buka sahaja).
- Jangkaan: baris set menunjukkan "Subjek · 2026 Set N", bilangan soalan dan amaran jika tidak lengkap. Penyunting memaparkan soalan dalam set dan kolam soalan tersedia.
- Rujukan: V2 `/admin/spm/tracking-a` (set 40 soalan, isi automatik, tukar, buang).
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-24.1 Latih Tubi (lorong admin)**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Daripada hub SPM klik **Buka senarai** pada kad Latih Tubi. 2. Pilih Subjek, taip 3 aksara dalam **Cari**, klik **Tapis**.
- Jangkaan: senarai soalan latih tubi, ditapis mengikut subjek dan teks, dengan pautan "lihat sisi pelajar".
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-25.1 Databank Soalan SPM**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Klik **Databank Soalan**. 2. Tapis Subjek **Sejarah**. 3. Klik satu soalan.
- Jangkaan: senarai 503 item (data demo) ditapis mengikut subjek; butiran dibuka.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

### Pengguna

**ADM-26.1 Senarai Pengguna: tapis dan cari**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah:
  1. Klik **Senarai Pengguna**. Lihat kiraan peranan (Pelajar, Guru, Ibu Bapa, Penaja, Admin Sekolah, Pegawai PPD, Admin).
  2. Pilih Peranan **Guru**, klik **Cari**.
  3. Pilih Sekolah "SMK Demo Satu".
  4. Pilih status **Tidak Aktif**.
  5. Taip `Demo` dalam kotak cari.
- Jangkaan: senarai berubah mengikut setiap penapis; kosong ditunjuk dengan mesej jika tiada padanan.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-26.2 Pengguna: tambah dan edit**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah:
  1. Klik **Tambah**. Isi: Nama `Guru Contoh Ujian`, Emel `guru.ujian@demo.test`, peranan Guru, sekolah "SMK Demo Satu". Simpan.
  2. Cari "Guru Contoh Ujian" dan klik **Edit**. Tukar nama kepada `Guru Contoh Ujian Dua`. Simpan.
  3. Buka menu "Tindakan lain" pada baris itu dan lihat pilihan.
- Jangkaan: pengguna baharu muncul dalam senarai; edit disimpan; menu tindakan memaparkan pilihan (contoh nyahaktif, tetapan semula kata laluan). Nyahaktifkan pengguna ujian ini selepas selesai.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-26.3 Pengguna: akaun menunggu kelulusan**
- Akaun: Admin Pusat. Prasyarat: ada akaun menunggu kelulusan (selepas ADM-31.1 atau data demo).
- Langkah: 1. Pada `/admin/users` lihat notis "akaun menunggu kelulusan, belum boleh log masuk". 2. Klik **Semak & luluskan**. 3. Luluskan satu akaun ujian.
- Jangkaan: senarai ditapis kepada akaun tidak aktif; selepas lulus, akaun menjadi Aktif dan notis berkurang.
- Rujukan: V2 `/admin/users?is_active=0`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-27.1 Sekolah**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Klik **Sekolah**. 2. Pilih Negeri **Selangor**, Jenis **SMK**, klik **Cari**. 3. Hidupkan "Tunjuk sekolah rendah". 4. Klik **Tambah Sekolah**: isi nama `Sekolah Contoh Ujian`, negeri, jenis, simpan. 5. Klik **Edit** pada sekolah baharu, tukar nama. 6. Klik **Nyahaktif** pada sekolah ujian itu.
- Jangkaan: senarai ditapis; sekolah baharu muncul; edit disimpan; sekolah menjadi Tidak Aktif.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-28.1 Langganan Sekolah**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Klik **Langganan Sekolah**. 2. Lihat kad Aktif, Tempoh Ihsan, Tamat Tempoh, Jumlah Kuota. 3. Tapis Status dan Tingkatan. 4. Klik **Langganan Baru** (isi borang pada sekolah demo, simpan atau batal).
- Jangkaan: kad dan jadual dipaparkan; langganan baharu muncul dalam senarai jika disimpan. Butiran langganan memaparkan invois pembaharuan.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-29.1 Import Pelajar (DELIMa)**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Klik **Import Pelajar**. 2. Taip dua huruf nama sekolah ("SK") dan pilih sekolah demo. 3. Pilih Tingkatan 4. 4. Klik **Paste Manual** dan tampal satu baris rekaan (nama murid rekaan sahaja). 5. Klik **Import**.
- Jangkaan: kuota pelajar sekolah dipaparkan; selepas import, ringkasan berjaya/langkau dipaparkan dan murid baharu muncul dalam Senarai Pengguna. Nyahaktifkan murid ujian kemudian.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-30.1 Pelajar Komplimen**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Klik **Pelajar Komplimen**. 2. Klik **Daftar Baru** dan lihat borang (batal jika tidak perlu).
- Jangkaan: kad Pelajar Komplimen, Syiling OFF dan Syiling ON; jadual kosong dengan mesej "Tiada pelajar komplimen lagi. Daftar baru."
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-31.1 Import Pengguna: peranan dan CSV**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah:
  1. Klik **Import Pengguna**.
  2. Lihat pilihan Peranan: **Guru, Ibu Bapa, Admin, PPD**.
  3. Pilih **Guru**, pilih sekolah "SMK Demo Satu".
  4. Pilih **Paste Manual** dan tampal: `Guru Contoh Import, guru.import@demo.test, 0123456789`.
  5. Klik **Import**.
  6. Ulang dengan emel yang sama sekali lagi.
- Jangkaan: akaun baharu dicipta (kata laluan lalai dipaparkan jika ada). Import kedua melangkau emel sedia ada. Akaun import menunggu kelulusan (lihat ADM-26.3).
- Rujukan: V2 `/admin/users/bulk-import` (V2: Guru, Ibu Bapa, Admin; V3 ada PPD tambahan). Pautan "Muat Turun CSV Pengguna" V2 tiada pada skrin V3.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

### Premium

**ADM-32.1 PKSK Soalan**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Klik **PKSK Soalan**. 2. Tukar penapis Bahagian (A, B, C), Level dan Status. 3. Klik **Tambah Soalan** dan lihat borang (Bahagian, Domain).
- Jangkaan: kad Jumlah, Diluluskan, Menunggu, Tingkatan 1, Tingkatan 4 (0 pada data demo). Borang tambah dipaparkan dengan Bahagian A/B/C dan senarai Domain.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-33.1 PKSK Akses: beri dan tarik**
- Akaun: Admin Pusat. Prasyarat: ID pengguna murid demo (daripada Senarai Pengguna).
- Langkah: 1. Klik **PKSK Akses**. 2. Klik **Beri Akses Baru**. 3. Isi User ID murid demo, pilih pakej "PKSK Tingkatan 1", kosongkan tarikh tamat. 4. Klik **Beri Akses**. 5. Pada baris itu klik **Tarik**.
- Jangkaan: akses baharu muncul dengan status Aktif; selepas Tarik, status berubah. Gunakan murid ujian, bukan murid yang sudah ada akses.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

### Sistem

**ADM-34.1 Kawalan Ciri: togol ciri**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah:
  1. Klik **Kawalan Ciri**. Baca nota "Semua ciri HIDUP secara lalai".
  2. Dalam bahagian **Pelajar**, klik **Tiket Bantuan** untuk menukar keadaan (Off ke Aktif).
  3. Klik sekali lagi untuk memulihkan.
  4. Muat semula halaman.
- Jangkaan: lencana bertukar Aktif/Off. Keadaan kekal selepas muat semula. Bahagian **Guru** (Headcount, Misi Harian, Kelas, dsb.) juga boleh dibuka. Jika ciri dimatikan, ia tersembunyi daripada pengguna (semak dengan akaun murid dalam tetingkap lain jika mahu).
- Rujukan: V2 `/admin/feature-toggles` (19 ciri pelajar, 10 ciri guru; V3 ada beberapa ciri tambahan).
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

### Gamifikasi

**ADM-35.1 Kedai Hadiah: katalog dan penapis**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah:
  1. Cari "Kedai Hadiah" dalam menu kiri. **Ia tiada** (rekod sebagai Gagal pada kes menu).
  2. Buka terus `http://localhost:5194/admin/hadiah`.
  3. Lihat kad Total Hadiah, Aktif, Tebusan Bulan Ini, Pending Proses.
  4. Klik penapis kategori **Gaming**, kemudian **Telco**, kemudian **Semua**.
- Jangkaan: jadual Katalog Hadiah (Hadiah, Kategori, RM, Token, Stok, Tebusan, Status, Tindakan). Penapis kategori mengubah senarai. Pada data demo semua hadiah berstatus Off.
- Rujukan: V2 `/admin/hadiah`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-35.2 Kedai Hadiah: tambah dan edit hadiah**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah:
  1. Pada `/admin/hadiah` klik **Tambah Hadiah**.
  2. Isi: Kategori **Pembelajaran**, Vendor (pilih satu), Tajuk `Hadiah Contoh Ujian`, Nilai (RM) `5`, Kos Token `5`, Stok `10`. Simpan.
  3. Cari hadiah itu dan klik **Edit**. Tukar Stok kepada `8`. Simpan.
  4. Cuba simpan dengan Tajuk kosong.
- Jangkaan: hadiah baharu muncul; edit disimpan. Medan wajib (Kategori, Vendor, Tajuk, Nilai, Kos Token) menunjukkan mesej ralat jika kosong. Nyahaktifkan hadiah ujian selepas selesai.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-36.1 Tebusan Queue**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Pada `/admin/hadiah` klik **Tebusan Queue**. 2. Klik tab **Menunggu**, **Dihantar**, **Dibatalkan**, **Semua**.
- Jangkaan: jadual Pelajar, Hadiah, RM, Token, Status, Tarikh, Tindakan. Pada data demo: "Tiada tebusan dalam status ini." Jika ada tebusan menunggu, tindakan proses (hantar/batal) tersedia.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

### Battle dan Permainan

**ADM-37.1 Battle Arena dan Leaderboard**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Pergi ke `http://localhost:5194/battle`. 2. Lihat pilihan jenis (Biasa, PKSK, SPM), subjek, bilangan soalan. 3. Pergi ke `/battle/leaderboard`, klik **Mingguan** dan **Bulanan**.
- Jangkaan: skrin Battle Arena dibuka; leaderboard menunjukkan "Belum ada data ranking" jika kosong. Tiada Ranking Sekolah (404) di V3.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-38.1 Tetapan Permainan: Papan Bijak**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah:
  1. Cari "Tetapan Permainan" dalam menu kiri. **Ia tiada** (rekod pada kes menu).
  2. Buka `http://localhost:5194/admin/permainan`.
  3. Lihat kad Jumlah Bilik, Sedang Aktif, Selesai, Pemain Unik.
  4. Dalam Papan Bijak, tukar Bilangan Petak Soalan kepada `30`. Lihat Pecahan Papan berubah. Klik **Simpan Tetapan**.
  5. Cuba nilai `40` (lebih had 38).
  6. Pulihkan nilai asal (35) dan simpan.
- Jangkaan: nilai sah disimpan dengan mesej. Nilai melebihi 38 ditolak atau dihadkan (teks bantuan: "Maks 38 petak"). Pecahan petak sentiasa berjumlah 50.
- Rujukan: V2 `/admin/permainan` (Papan Bijak 0-38 petak).
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-38.2 Tetapan Permainan: ganjaran, had dan senarai permainan**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Pada `/admin/permainan` skrol ke "Ganjaran & Had Permainan". 2. Tukar "Had syiling permainan sehari" kepada nilai lain, klik **Simpan Tetapan**. 3. Muat semula, semak nilai. 4. Pulihkan nilai asal. 5. Lihat "Senarai Permainan" (Papan Bijak, Battle Arena, Kad Memori, dll.).
- Jangkaan: nilai kekal selepas muat semula. Setiap permainan ada lencana Aktif/Off.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

### Marketplace

**ADM-39.1 Produk**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Klik **Produk**. 2. Pilih Kategori **Buku & Rujukan**, Status **Aktif**, klik **Tapis**, kemudian **Reset**. 3. Klik **Tambah Produk**: Nama `Produk Contoh Ujian`, Harga `10`, simpan. 4. Klik **Edit** pada produk itu, tukar harga. 5. Klik **Nyahaktif**.
- Jangkaan: senarai ditapis; produk baharu muncul; edit disimpan; status berubah kepada tidak aktif. Jangan klik **Padam** pada produk demo.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-40.1 Penjual**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Klik **Penjual**. 2. Tapis Status **Aktif**. 3. Klik **Lihat Detail** pada satu penjual. 4. Lihat butang Gantung dan Haramkan (jangan tekan pada penjual demo).
- Jangkaan: kad Jumlah Penjual, Aktif, Menunggu Pengesahan; butiran penjual dan produknya dipaparkan.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

### Kandungan

**ADM-41.1 Artikel**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Klik **Artikel**. 2. Tapis Kategori **Tips Belajar**, Status **Diterbitkan**, kemudian cari satu perkataan. 3. Klik **Tambah**: Tajuk `Artikel Contoh Ujian`, kategori, isi pendek, Draf. Simpan. 4. Klik **Edit**, ubah kepada Diterbitkan, simpan. 5. Padam artikel ujian itu daripada menu tindakan.
- Jangkaan: artikel muncul, status bertukar, dan hilang selepas dipadam. Jangan padam artikel demo lain.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-42.1 Banner**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Klik **Banner**. 2. Klik **Tambah**: Tajuk `Banner Contoh Ujian`, Jenis Hero, Sasaran ALL, simpan. 3. Klik **Edit**, tukar susunan kepada 5. 4. Gunakan menu **Tindakan** untuk nyahaktif banner ujian.
- Jangkaan: banner baharu muncul dalam jadual (Tajuk, Jenis, Sasaran, Susunan, Mula, Tamat, Aktif?). Perubahan disimpan.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-43.1 Nota**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Klik **Nota**. 2. Tukar penapis Subjek dan Jenis. 3. Klik **Tambah Nota** dan lihat borang (jangan muat naik fail sebenar).
- Jangkaan: kad Jumlah nota, Diterbitkan, Muat turun; mesej "Tiada nota dijumpa" jika kosong. Borang dibuka.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-44.1 Upload Screenshot**
- Akaun: Admin Pusat. Prasyarat: satu gambar PNG kecil rekaan.
- Langkah: 1. Klik **Upload Screenshot**. 2. Klik kawasan muat naik dan pilih gambar PNG. 3. Lihat senarai "Fail Sedia Ada".
- Jangkaan: fail dimuat naik dan muncul dalam senarai; format selain JPG, PNG, GIF, WebP, BMP ditolak dengan mesej.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-45.1 Video**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Klik **Video**. 2. Tapis Subjek. 3. Klik **Tambah Video** (isi tajuk `Video Contoh Ujian` dan pautan rekaan, simpan atau batal).
- Jangkaan: jadual Tajuk, Kategori, Subjek, Tontonan, Tarikh, Tindakan. Video baharu muncul jika disimpan.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

### Sistem

**ADM-46.1 Tetapan sokongan**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Klik **Tetapan** (bawah Sistem). 2. Tukar E-mel sokongan kepada `sokongan.ujian@demo.test`. 3. Klik **Simpan Tetapan**. 4. Muat semula. 5. Pulihkan nilai asal.
- Jangkaan: mesej berjaya; nilai kekal selepas muat semula. E-mel tidak sah ditolak.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

### Tambahan V3

**ADM-47.1 Tiket Bantuan**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Klik **Tiket Bantuan**. 2. Tapis Peranan **Murid**. 3. Klik tab **Dibuka**, kemudian **Semua**. 4. Klik satu tiket dan baca butiran.
- Jangkaan: jadual Tarikh, Pengguna, Peranan, Sekolah, Subjek, Status, Dibalas; bilangan pada tab sepadan dengan senarai.
- Rujukan: bukan menu admin V2 (ciri Tiket Bantuan murid boleh dimatikan di Kawalan Ciri).
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**ADM-48.1 Kelas Sekolah**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Klik **Kelas Sekolah**. 2. Pilih Sekolah dan Guru, klik **Cari**. 3. Klik satu kelas.
- Jangkaan: senarai kelas ditapis; butiran kelas dibuka.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

### Semakan lintang (semua skrin)

**ADM-49.1 Mudah alih dan menu**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Kecilkan tetingkap pelayar kepada lebar 375 px. 2. Buka menu (ikon hamburger). 3. Pilih tiga skrin: Dashboard, Senarai Pengguna, Kedai Hadiah (melalui URL).
- Jangkaan: menu boleh dibuka dan ditutup; tiada skrol ke tepi; jadual boleh disorot; butang tidak terpotong.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

---

# Bahagian 2: Guru

Akan ditambah.

# Bahagian 3: Admin Sekolah

Akan ditambah.

# Bahagian 4: Murid

Akan ditambah.
