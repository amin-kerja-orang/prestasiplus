# Skrip Ujian Manual V3 (semakan tempatan)

Skrip ini untuk pemilik produk menyemak V3 dengan tangan di pelayar. Ia akan bertambah mengikut portal (Admin Pusat dahulu).

## Cara guna

1. Buka pelayar dan pergi ke `http://localhost:5194`.
2. Log masuk dengan akaun dalam `AKAUN-DEMO-V3-LOCAL.md` (di akar repo). Kata laluan demo bersama: `Demo1234`.
   - Admin Pusat: `admin@demo.test`
   - Admin Sekolah: `adminsekolah@demo.test`
3. Ikut kes ujian satu demi satu. Tanda `Keputusan` dan tulis `Komen` jika ada masalah.
4. Semua data contoh dalam skrip ini rekaan. Jangan padam rekod sedia ada (data demo dikongsi). Kembalikan nilai yang anda ubah.
5. Untuk bertukar akaun: klik nama anda di penjuru menu, pilih **Log Keluar**, kemudian log masuk semula.
6. Cuba juga skrin pada lebar telefon (375 px) dan tablet (768 px): tiada skrol ke tepi, menu boleh dicapai.

### Petunjuk keadaan di V3 (jadual liputan)

| Kod | Maksud |
|---|---|
| Berfungsi | Skrin dibuka dengan kandungan sebenar dan ada kes ujian. |
| Separa | Skrin ada tetapi ada bahagian Panel yang tiada, atau letaknya berbeza. |
| Tiada | Halaman 404 "Halaman Tidak Dijumpai" atau tiada pautan. Belum dibina di V3. |
| Ditolak (403) | Skrin tidak dibenarkan untuk peranan itu. Ini jangkaan yang betul jika Panel pun melarang. |

### Petunjuk keputusan

`☐ Lulus` = sama seperti jangkaan. `☐ Gagal` = tidak sama; tulis apa yang dilihat dalam `Komen`.

Nota: pemerhatian "Keadaan di V3" direkod pada 9 Nov 2026 pada data demo. Banyak senarai kecil atau kosong; ini bukan ralat.

---

# Bahagian 1: Admin Pusat (aliran Panel admin.prestasiplus.cloud)

Sumber: aplikasi Panel V2 (aplikasi berasingan pada subdomain admin, bukan menu `/admin` lama). Panel boleh dimasuki oleh tiga peranan: Admin Pusat, Admin Sekolah dan Pegawai PPD. Pegawai PPD tidak diuji di sini (tiada akaun demo dalam skrip ini).

Di V3, Admin Pusat guna portal `/admin/...`. Admin Sekolah guna portal berasingan `/admin-sekolah/...` dan **tidak boleh** membuka `/admin/...` (skrin "403 Akses Ditolak"). Jadi satu skrin Panel yang dikongsi dua peranan dipetakan kepada dua skrin V3.

Semua URL V3 bermula dengan `http://localhost:5194`.

## 1.1 Jadual liputan

Menu sisi Panel: Papan Pemuka, Analitik, Pengguna, Sekolah, Kandungan SPM, Question Studio, Tanda Karangan.

| No | Menu Panel (URL Panel) | Siapa | Menu V3 | URL V3 | Keadaan di V3 | Kes ujian |
|---|---|---|---|---|---|---|
| 1 | Papan Pemuka (`/`): kad Pelajar, Guru, Sekolah | Pusat | Harian > Dashboard | `/admin` | Berfungsi (lebih banyak kad daripada Panel) | PNL-01.1 |
| 1b | Papan Pemuka (`/`), terhad kepada sekolah sendiri | Sekolah | Dashboard | `/admin-sekolah` | Berfungsi (kod sekolah, jumlah pelajar/guru/kelas, ringkasan prestasi) | PNL-01.2 |
| 2 | Analitik (`/analitik`): trend 7 hari, sekolah teratas, pelajar teratas, mood | Pusat | Analitik > Analitik, dan Command Center | `/admin/analytics`, `/admin/command-center` | Berfungsi (angka tersebar pada dua skrin) | PNL-02.1 |
| 2b | Analitik (`/analitik`), sekolah sendiri | Sekolah | Statistik Penggunaan, Laporan Aktiviti | `/admin-sekolah/statistik-penggunaan`, `/admin-sekolah/laporan-aktiviti` | Berfungsi (skrin berbeza daripada Panel; `/admin/analytics` ditolak 403) | PNL-02.2 |
| 3 | Pengguna (`/pengguna`): cari, peranan, aktifkan akaun | Pusat | Pengguna > Senarai Pengguna | `/admin/users` | Berfungsi (ada penapis lebih banyak, notis akaun menunggu kelulusan) | PNL-03.1, 03.2 |
| 3b | Pengguna (`/pengguna`), pelajar, guru dan admin sekolah sendiri | Sekolah | Senarai Pelajar, Senarai Guru | `/admin-sekolah/pelajar`, `/admin-sekolah/guru` | Berfungsi (tiada paparan admin sekolah lain; Pelajar ada notis "menunggu kelulusan") | PNL-03.3 |
| 4 | Sekolah (`/sekolah`): senarai, togol aktif | Pusat | Pengguna > Sekolah | `/admin/schools` | Berfungsi (butang Nyahaktif/Edit) | PNL-04.1 |
| 4b | Sekolah: **tukar kod pendaftaran** (hanya Admin Pusat) | Pusat | (tiada) | `/admin/schools` | Tiada: tiada lajur "Kod Daftar" dan tiada butang tukar kod | PNL-04.2 |
| 4c | Sekolah (`/sekolah`): lihat kod daftar sekolah sendiri | Sekolah | Dashboard | `/admin-sekolah` | Separa: tajuk menunjukkan "Kod: DEMO001" (kod sekolah); tidak jelas sama ada ini kod pendaftaran | PNL-04.3 |
| 5 | Kandungan SPM, hub (`/spm`): enam laluan | Pusat | Soalan > SPM | `/admin/spm` | Berfungsi (6 kad) | PNL-05.1 |
| 5b | Kandungan SPM: Admin Sekolah dihalang | Sekolah | - | `/admin/spm` | Ditolak (403), seperti Panel | PNL-05.2 |
| 6 | Laluan Databank (`/spm/databank`) | Pusat | Kad Databank pada hub / Soalan > Databank | `/admin/spm/databank` | Berfungsi | PNL-06.1 |
| 7 | Sunting soalan SPM (`/spm/soalan/{q}/sunting`) | Pusat | Butang Sunting pada Databank | `/admin/spm/soalan/ID/sunting` | Berfungsi (borang Teks soalan, Pilihan A-D, Pilihan jawapan, Penjelasan, amaran "belum lengkap") | PNL-06.2 |
| 8 | Pratonton soalan (`/spm/soalan/{q}/pratonton`) | Pusat | Butang Pratonton pada Databank | `/admin/studio/questions/ID/preview` | Berfungsi (dibuka dalam editor Studio, tab Pratonton) | PNL-06.3 |
| 9 | Laluan Tracking A (`/spm/tracking-a`) | Pusat | Kad Tracking A | `/admin/spm/tracking-a` | Berfungsi (10 set, penapis subjek, Tambah Set) | PNL-07.1 |
| 10 | Sunting set Tracking A: isi, tukar, simpan | Pusat | Butang Sunting | `/admin/spm/tracking-a/ID/sunting` | Separa: ada tukar, buang, Naik, Turun, Simpan; butang "Isi set" tidak kelihatan; pengepala menunjukkan "50 / 34" | PNL-07.2 |
| 11 | Laluan Subjektif (`/spm/subjektif`) | Pusat | Kad Subjektif | `/admin/spm/subjektif` | Berfungsi (18 item) | PNL-08.1 |
| 12 | Editor skema dan rubrik subjektif (`/spm/subjektif/{q}/sunting`) | Pusat | Butang Sunting pada laluan Subjektif | `/admin/studio/questions/ID/sunting`; paparan `/admin/structured-questions/ID` | Separa: Sunting membuka editor Studio umum; paparan berstruktur hanya baca (tiada medan poin rubrik A1..An kelihatan) | PNL-08.2 |
| 13 | Laluan Simulasi / Bijak SPM (`/spm/simulasi`) | Pusat | Kad Bijak SPM | `/admin/spm/simulasi` | Berfungsi (7 kertas, penapis status, Pratonton, Salin, Sunting) | PNL-09.1 |
| 14 | Semak kertas simulasi: terbit, tarik balik, salin, tambah soalan (`/spm/simulasi-paper/{p}/review`) | Pusat | Sunting pada Simulasi | `/admin/spm/kertas/ID` | Berfungsi (Terbitkan, Salin set, Pratonton sebagai pelajar, senarai masalah blueprint) | PNL-09.2 |
| 15 | Laluan Kertas dan CRUD kertas (`/spm/kertas`, `/spm/kertas/{p}`) | Pusat | Soalan > Kertas Subjektif | `/admin/kertas-subjektif` | Berfungsi (senarai kosong 0 kertas, penapis, butang Baharu); `/admin/spm/kertas` dialihkan ke Set Builder | PNL-10.1 |
| 16 | Laluan Latih Tubi (`/spm/latih-tubi`) | Pusat | Kad Latih Tubi | `/admin/spm/latih-tubi` | Berfungsi | PNL-11.1 |
| 17 | Kontrak Simulasi (`/spm/kontrak`) | Pusat | Butang Kontrak pada Set Builder | `/admin/spm/kontrak`, `/admin/spm/kontrak/MAT/1`, `.../kolam` | Berfungsi (senarai kontrak, editor, pengesahan, kolam soalan) | PNL-12.1 |
| 18 | Question Studio, senarai (`/studio`) | Pusat | Soalan > Bank Soalan (Studio) | `/admin/studio` | Berfungsi | PNL-13.1 |
| 19 | Studio: pratonton dan sunting soalan (`/studio/preview/{q}`, `/studio/{q}/edit`) | Pusat | Pratonton dan Edit pada baris | `/admin/studio/questions/ID/preview`, `/sunting` | Berfungsi (langkah Tag, Kertas, Rangsangan, Sub-bahagian) | PNL-13.2 |
| 20 | Studio: Arkib / Sembunyikan | Pusat | Butang Sembunyikan pada baris | `/admin/studio` | Berfungsi (butang ada; soalan diarkib ada butang "Pulihkan ke draf") | PNL-13.3 |
| 21 | Studio: Set Builder (`/studio/sets/{p}/builder`, `bank`, `documents`) | Pusat | Soalan > Set Builder | `/admin/studio/sets`, `/admin/studio/sets/ID/builder` | Berfungsi (Bank Soalan dan Set dalam satu halaman; tiada URL `bank` dan `documents` berasingan, 404) | PNL-13.4 |
| 22 | Tanda Karangan: sahkan atau laras markah AI (`/spm/tanda-karangan`) | Sekolah (dan Pusat) | (tiada) | `/admin/spm/tanda-karangan`, `/admin-sekolah/tanda-karangan` | Tiada: 404 | PNL-14.1 |

### Ringkasan liputan

| Perkara | Bilangan |
|---|---|
| Baris fungsi Panel (termasuk varian Admin Sekolah) | 28 |
| Berfungsi di V3 | 22 |
| Separa (baris 4c, 10, 12) | 3 |
| Tiada (baris 4b tukar kod pendaftaran, baris 22 Tanda Karangan) | 2 |
| Ditolak 403 yang betul (baris 5b) | 1 |
| Blok kes ujian | 30 |

---

## 1.2 Kes ujian

Prasyarat umum: sudah log masuk dengan akaun yang dinyatakan dalam setiap kes.

### Papan Pemuka

**PNL-01.1 Papan Pemuka Admin Pusat**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah:
  1. Log masuk. Anda dibawa ke Dashboard (`/admin`).
  2. Lihat kad Pengguna (jumlah pelajar), Subjek dan Battle Arena.
  3. Klik **Tambah Soalan Baru**, kembali; klik **Import & Semakan Soalan**.
- Jangkaan: paparan menunjukkan jumlah pelajar, guru dan sekolah seluruh negara (Panel: kad Pelajar, Guru, Sekolah). Pautan pantas membuka skrin betul.
- Rujukan: Panel `/`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-01.2 Papan Pemuka Admin Sekolah**
- Akaun: Admin Sekolah. Prasyarat: tiada.
- Langkah:
  1. Log masuk. Anda dibawa ke `/admin-sekolah`.
  2. Baca tajuk sekolah, jumlah Pelajar, Guru dan Kelas Aktif.
  3. Cuba buka `http://localhost:5194/admin`.
- Jangkaan: angka hanya untuk sekolah sendiri (SMK Demo Satu). Membuka `/admin` membawa kembali ke `/admin-sekolah` (tiada angka seluruh negara).
- Rujukan: Panel `/` (terhad kepada sekolah sendiri).
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

### Analitik

**PNL-02.1 Analitik Admin Pusat**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah:
  1. Klik **Analitik** dalam menu. Lihat kad Sekolah, Pelajar, Soalan Dijawab, Ketepatan, carta trend harian dan Top Sekolah.
  2. Klik **Command Center**. Lihat Top Sekolah, Top Pelajar Minggu Ini dan Mood Pelajar.
- Jangkaan: angka keseluruhan platform dipaparkan. Trend, sekolah teratas, pelajar teratas dan mood semuanya ada di antara kedua-dua skrin. Tiada ralat.
- Rujukan: Panel `/analitik` (satu halaman di Panel, dua halaman di V3).
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-02.2 Analitik Admin Sekolah**
- Akaun: Admin Sekolah. Prasyarat: tiada.
- Langkah:
  1. Klik **Statistik Penggunaan**. Tukar tempoh Hari Ini, 7 Hari, 30 Hari.
  2. Klik **Laporan Aktiviti**. Tukar tempoh 7 Hari, 30 Hari, 3 Bulan. Lihat tab Guru dan Murid.
  3. Buka `/admin/analytics`.
- Jangkaan: angka hanya untuk sekolah sendiri. Tiada jadual "sekolah teratas" yang membandingkan sekolah lain. `/admin/analytics` memaparkan "403 Akses Ditolak".
- Rujukan: Panel `/analitik` (sekolah sendiri; jadual sekolah teratas disembunyikan).
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

### Pengguna

**PNL-03.1 Pengguna Admin Pusat: cari dan tapis**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah:
  1. Klik **Senarai Pengguna**. Lihat kiraan setiap peranan.
  2. Pilih Peranan **Guru**, klik **Cari**.
  3. Taip `Demo` dalam kotak cari dan klik **Cari**.
  4. Pilih Sekolah "SMK Demo Satu".
- Jangkaan: senarai berubah mengikut penapis; semua peranan (termasuk Admin dan Pegawai PPD) kelihatan dalam pilihan Peranan.
- Rujukan: Panel `/pengguna`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-03.2 Pengguna Admin Pusat: aktifkan akaun**
- Akaun: Admin Pusat. Prasyarat: ada akaun menunggu kelulusan (notis di atas senarai, contoh "1 akaun menunggu kelulusan").
- Langkah:
  1. Pada `/admin/users` klik **Semak & luluskan** pada notis.
  2. Pilih satu akaun tidak aktif, lalu aktifkannya (menu tindakan atau Edit).
- Jangkaan: mesej berjaya; akaun menjadi Aktif; notis berkurang. (Panel: mesej "Akaun ... telah diaktifkan, pengguna kini boleh log masuk".)
- Rujukan: Panel `/pengguna/{user}/activate`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-03.3 Pengguna Admin Sekolah: hanya sekolah sendiri**
- Akaun: Admin Sekolah. Prasyarat: tiada.
- Langkah:
  1. Klik **Senarai Pelajar**. Lihat notis "menunggu kelulusan atau tidak aktif".
  2. Taip nama dalam kotak cari, klik **Cari**; tapis Status **Tidak Aktif**.
  3. Klik **Senarai Guru** dan ulang carian.
  4. Cuba buka `/admin/users`.
- Jangkaan: hanya murid dan guru SMK Demo Satu dipaparkan. Akaun Admin Pusat dan Pegawai PPD tidak kelihatan. Akaun tidak aktif boleh diaktifkan oleh admin sekolah untuk sekolahnya sahaja. `/admin/users` memaparkan "403 Akses Ditolak".
- Rujukan: Panel `/pengguna` (peranan Pelajar, Guru, Admin Sekolah sahaja).
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

### Sekolah

**PNL-04.1 Sekolah Admin Pusat: senarai dan togol aktif**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah:
  1. Klik **Sekolah**. Lihat kad Jumlah Sekolah, Aktif, Tidak Aktif.
  2. Pilih Negeri **Selangor**, klik **Cari**.
  3. Klik **Nyahaktif** pada satu sekolah, sahkan, kemudian aktifkan semula sekolah itu (melalui **Edit** > "Sekolah Aktif").
- Jangkaan: jadual menunjukkan Nama, Kod, Jenis, Negeri, Daerah, jumlah Pelajar dan Guru, Status. Status berubah dan dipulihkan. Gunakan sekolah demo "SK Demo Dua" untuk ujian.
- Rujukan: Panel `/sekolah/{school}/toggle`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-04.2 Sekolah Admin Pusat: tukar kod pendaftaran**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Buka `/admin/schools`. 2. Cari lajur "Kod Daftar" dan butang "Tukar kod pendaftaran". 3. Buka **Edit** satu sekolah dan cari medan yang sama.
- Jangkaan (sasaran): kod pendaftaran sekolah dipaparkan dan boleh ditukar dengan satu pengesahan "Tukar kod pendaftaran?". **Keadaan semasa: tiada**. Rekod sebagai Gagal selagi tiada.
- Rujukan: Panel `/sekolah/{school}/join-code`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-04.3 Sekolah Admin Sekolah: lihat kod sekolah sendiri**
- Akaun: Admin Sekolah. Prasyarat: tiada.
- Langkah: 1. Pada Dashboard (`/admin-sekolah`) lihat tajuk sekolah dan "Kod: DEMO001". 2. Cuba cari kod pendaftaran (yang murid atau guru guna untuk menyertai sekolah) di Dashboard, Senarai Pelajar dan Senarai Guru. 3. Buka `/admin/schools`.
- Jangkaan: Admin Sekolah nampak kod sekolah sendiri sahaja. Tiada butang tukar kod (hanya Admin Pusat). `/admin/schools` memaparkan "403 Akses Ditolak". Catat dalam Komen sama ada "Kod: DEMO001" ialah kod pendaftaran sebenar.
- Rujukan: Panel `/sekolah` (sekolah sendiri sahaja; tukar kod hanya Admin Pusat).
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

### Kandungan SPM (Admin Pusat sahaja)

**PNL-05.1 Hub SPM**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Klik **SPM** (bawah Soalan). 2. Baca enam kad: Databank Soalan, Tracking A, Subjektif, Bijak SPM, Kertas Subjektif, Latih Tubi. 3. Klik **Buka senarai** pada setiap kad, kembali melalui "Semua laluan SPM". 4. Klik **lihat sisi pelajar** pada satu kad.
- Jangkaan: setiap kad ada nombor dan status ("Semua elok" atau amaran). Setiap pautan membuka skrin yang betul.
- Rujukan: Panel `/spm` (V3 menambah kad Latih Tubi, keputusan D118).
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-05.2 Admin Sekolah dihalang daripada Kandungan SPM**
- Akaun: Admin Sekolah. Prasyarat: tiada.
- Langkah: 1. Cari menu SPM dan Studio dalam menu sisi. 2. Buka `/admin/spm`, `/admin/spm/tracking-a` dan `/admin/studio`.
- Jangkaan: tiada menu SPM atau Studio dalam menu Admin Sekolah; ketiga-tiga URL memaparkan "403 Akses Ditolak".
- Rujukan: Panel (SPM dan Studio untuk Admin Pusat sahaja).
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-06.1 Databank Soalan: senarai dan tapis**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Daripada hub, klik **Buka senarai** pada Databank Soalan. 2. Pilih Subjek **Sejarah** dan Status **Diluluskan**, klik **Tapis**. 3. Taip 3 aksara dalam **Cari**, klik **Tapis**. 4. Klik halaman seterusnya.
- Jangkaan: senarai ditapis; jumlah item dipaparkan di atas ("503 item"); paginasi berfungsi.
- Rujukan: Panel `/spm/databank`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-06.2 Sunting soalan SPM**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Pada Databank, klik **Sunting** pada satu soalan. 2. Lihat medan Teks soalan, Pilihan A-D, Pilihan jawapan dan Penjelasan, serta amaran "belum lengkap". 3. Tambah perkataan "UJI" pada Penjelasan, klik **Simpan**. 4. Buka semula, buang "UJI", simpan.
- Jangkaan: perubahan disimpan dengan mesej; medan wajib kosong ditolak. Nilai asal dipulihkan.
- Rujukan: Panel `/spm/soalan/{q}/sunting`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-06.3 Pratonton soalan**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Pada Databank, klik **Pratonton** pada satu soalan. 2. Lihat tab **Pratonton**, kemudian tab **Tag**, **Kertas**, **Rangsangan**, **Sub-bahagian**.
- Jangkaan: soalan dipapar seperti yang murid akan lihat tanpa mengubah data. Status dan "Dilihat murid di N daripada N aktiviti" dipaparkan.
- Rujukan: Panel `/spm/soalan/{q}/pratonton`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-07.1 Tracking A: senarai**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Daripada hub, buka Tracking A. 2. Tapis Subjek **Sains**, klik **Tapis**. 3. Baca setiap baris (subjek, tahun, set, bilangan soalan, perhatian). 4. Klik **Tambah Set** (buka sahaja).
- Jangkaan: 10 set pada data demo; penapis berfungsi; amaran dipaparkan pada set tidak lengkap.
- Rujukan: Panel `/spm/tracking-a`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-07.2 Tracking A: sunting set (isi, tukar, buang, susun, simpan)**
- Akaun: Admin Pusat. Prasyarat: tiada. Gunakan satu set sahaja dan pulihkan selepas ujian.
- Langkah: 1. Klik **Sunting** pada satu set. 2. Baca pengepala "Soalan dalam set" dan "Sasaran soalan". 3. Cari butang untuk mengisi set secara automatik. 4. Klik **tukar** pada satu soalan, pilih soalan lain. 5. Klik **Turun** kemudian **Naik** pada soalan itu. 6. Klik **buang** pada satu soalan, kemudian tambah semula. 7. Klik **Simpan**.
- Jangkaan: set 40 soalan objektif; amaran "N soalan lagi diperlukan" jika tidak cukup; butang isi automatik; tukar, buang dan susun berfungsi; Simpan menyimpan. **Keadaan semasa:** butang isi automatik tidak kelihatan; pengepala menunjukkan "50 / 34" (lebih daripada sasaran). Catat apa yang anda lihat.
- Rujukan: Panel `/spm/tracking-a/{set}/sunting` (isi, tukar, simpan).
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-08.1 Laluan Subjektif**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Daripada hub, buka Subjektif. 2. Pilih Subjek **Matematik Tambahan** dan Status, klik **Tapis**. 3. Klik **lihat sisi pelajar**.
- Jangkaan: senarai 18 soalan berstruktur ditapis; pautan sisi pelajar dibuka.
- Rujukan: Panel `/spm/subjektif`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-08.2 Editor skema dan rubrik**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Pada laluan Subjektif, klik **Sunting** pada satu soalan. 2. Cari bahagian "Skema" dan "Poin Rubrik" (A1, A2, ... dengan markah setiap poin). 3. Cari nota "Rubrik di sini yang menentukan pemarkahan automatik". 4. Buka `/admin/structured-questions` dan klik **Lihat** pada soalan yang sama.
- Jangkaan (sasaran): setiap bahagian ada skema dan poin rubrik yang boleh disunting; baris kosong membuang poin. **Keadaan semasa:** Sunting membuka editor soalan Studio; paparan berstruktur hanya menunjukkan sub-soalan dan "Jawapan Model". Medan poin rubrik tidak kelihatan. Catat apa yang anda lihat.
- Rujukan: Panel `/spm/subjektif/{q}/sunting`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-09.1 Laluan Simulasi (Bijak SPM)**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Daripada hub, buka Bijak SPM. 2. Pilih Status **Draf**, klik **Tapis**. 3. Klik **Pratonton** pada satu kertas, kembali. 4. Klik **Salin** pada satu kertas (kemudian padam salinan itu daripada Set Builder).
- Jangkaan: 7 kertas pada data demo; penapis Status (Draf, Sedia Terbit, Ditarik balik) berfungsi; salinan baharu muncul.
- Rujukan: Panel `/spm/simulasi`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-09.2 Semak kertas simulasi dan terbit**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Pada laluan Simulasi, klik **Sunting** pada satu kertas draf. 2. Baca senarai masalah ("Belum sepadan dengan blueprint"). 3. Lihat butang **Terbitkan**. 4. Klik **Pratonton sebagai pelajar**. 5. Ubah **Tajuk** dan klik **Simpan**, kemudian pulihkan.
- Jangkaan: selagi ada masalah, mesej "Kertas belum boleh diterbitkan: selesaikan N perkara" dipaparkan dan kertas tidak boleh diterbitkan. Pratonton, Salin set dan Sunting di Set Builder berfungsi. Jangan terbitkan kertas demo.
- Rujukan: Panel `/spm/simulasi-paper/{paper}/review` (terbit, tarik balik, salin).
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-10.1 Kertas (senarai dan baharu)**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Klik **Kertas Subjektif** dalam menu. 2. Tukar penapis Subjek, Kertas (2/3/4) dan Status (Terbit/Draf), klik **Tapis**. 3. Klik **Baharu** (lihat borang; batal jika tidak perlu). 4. Pada hub SPM, buka kad Kertas Subjektif.
- Jangkaan: kad Jumlah Kertas, Diterbitkan, Ada Skema; senarai kosong dengan mesej jelas jika tiada kertas. Cipta, sunting, padam dan terbit kertas boleh dibuat jika ada kertas.
- Rujukan: Panel `/spm/kertas` (CRUD dan terbit).
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-11.1 Latih Tubi**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Daripada hub, buka Latih Tubi. 2. Pilih Subjek, taip 3 aksara dalam **Cari**, klik **Tapis**.
- Jangkaan: senarai 521 item (data demo), ditapis mengikut subjek dan teks.
- Rujukan: Panel `/spm/latih-tubi`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-12.1 Kontrak Simulasi**
- Akaun: Admin Pusat. Prasyarat: tiada. Jangan simpan perubahan pada kontrak demo kecuali dipulihkan.
- Langkah: 1. Buka `/admin/spm/kontrak` (atau butang **Kontrak Simulasi** pada Set Builder). 2. Buka kontrak **Matematik Kertas 1**. 3. Baca amaran "Kontrak dikongsi". 4. Lihat bahagian Maklumat Kertas, Bahagian A, Pengesahan. 5. Klik **Pratonton Kolam**.
- Jangkaan: senarai kontrak setiap subjek dan kertas; editor memaparkan Kod Kertas, Tempoh, Jumlah Markah, bahagian dan status (Draf, Spec, Disahkan). Kolam soalan menunjukkan baris kurang dan soalan tidak layak, serta butang "Jana Draf Kertas" yang dilumpuhkan jika kolam tidak cukup.
- Rujukan: Panel `/spm/kontrak`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

### Question Studio (Admin Pusat sahaja)

**PNL-13.1 Studio: senarai dan penapis**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Klik **Bank Soalan (Studio)**. 2. Klik pautan status **Draf**, kemudian **Diterbitkan**. 3. Pilih Subjek **Matematik**, Tingkatan 4, klik **Tapis**. 4. Tukar "25 / halaman" dan buka halaman 2.
- Jangkaan: senarai ditapis; kiraan status dan paginasi betul.
- Rujukan: Panel `/studio`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-13.2 Studio: pratonton dan sunting soalan**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Klik **Pratonton** pada satu soalan. 2. Kembali, klik **Edit**. 3. Lihat langkah 1 Tag, 2 Kertas, 3 Rangsangan, 4 Sub-bahagian. 4. Ubah Kesukaran, simpan, kemudian pulihkan.
- Jangkaan: pratonton memaparkan soalan; editor menyimpan perubahan dengan mesej; soalan yang sudah diterbitkan tidak boleh disunting secara senyap (ada butang "Edit sebagai draf" jika perlu).
- Rujukan: Panel `/studio/preview/{q}`, `/studio/{q}/edit`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-13.3 Studio: arkib dan pulih**
- Akaun: Admin Pusat. Prasyarat: guna soalan Draf contoh (kad Draf, 1 soalan).
- Langkah: 1. Klik **Sembunyikan** pada soalan itu. 2. Klik pautan status **Diarkibkan**. 3. Buka soalan itu dan klik **Pulihkan ke draf**.
- Jangkaan: soalan berpindah ke Diarkibkan dan dipapar "Tidak dipapar kepada pelajar"; selepas Pulihkan ia kembali Draf.
- Rujukan: Panel `/studio/{q}/archive`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-13.4 Studio: Set Builder**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Klik **Set Builder**. 2. Klik **Buka** pada satu set draf. 3. Dalam tab **Bank Soalan**, cari soalan, pilih Bahagian A dan klik **Tambah**. 4. Dalam tab **Set**, klik **Naik soalan 1**, **Turun soalan 1**, kemudian **Buang soalan**. 5. Klik **Simpan bahagian**. 6. Klik **Semak Kertas**.
- Jangkaan: soalan ditambah, disusun, dibuang; markah bahagian dikira; Semak Kertas menyenaraikan masalah blueprint; Terbitkan dilumpuhkan selagi ada masalah. Tiada halaman `bank` atau `documents` berasingan (kedua-duanya 404 jika dibuka terus).
- Rujukan: Panel `/studio/sets/{paper}/builder`, `bank`, `documents`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

### Tanda Karangan

**PNL-14.1 Tanda Karangan (semakan markah AI)**
- Akaun: Admin Sekolah (kemudian Admin Pusat). Prasyarat: ada jawapan karangan yang menunggu semakan.
- Langkah: 1. Cari **Tanda Karangan** dalam menu sisi. 2. Cuba buka `/admin-sekolah/tanda-karangan` dan `/admin/spm/tanda-karangan`.
- Jangkaan (sasaran): senarai karangan pelajar sekolah sendiri dengan "Jawapan pelajar", "Skema", "Justifikasi AI", "Markah muktamad" dan butang **Sahkan**; jika kosong: "Tiada karangan menunggu semakan." **Keadaan semasa: tiada menu dan kedua-dua URL memaparkan 404**. Rekod sebagai Gagal selagi tiada.
- Rujukan: Panel `/spm/tanda-karangan`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

### Semakan lintang

**PNL-15.1 Mudah alih dan menu (kedua-dua portal)**
- Akaun: Admin Pusat, kemudian Admin Sekolah. Prasyarat: tiada.
- Langkah: 1. Kecilkan tetingkap kepada lebar 375 px. 2. Buka menu (ikon hamburger) dan pilih tiga skrin. 3. Ulang pada 768 px.
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
