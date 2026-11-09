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

### Petunjuk perbandingan V2 vs V3

| Kod | Maksud |
|---|---|
| Sama | Elemen, label dan peraturan yang dilihat pada Panel V2 ada pada V3. |
| Beza | V3 berbeza (diterangkan pendek). Ada yang lebih lengkap di V3, ada yang kurang. |
| Tiada di V3 | Skrin atau fungsi V2 tidak ada di V3. |

### Petunjuk keputusan

`☐ Lulus` = sama seperti jangkaan. `☐ Gagal` = tidak sama; tulis apa yang dilihat dalam `Komen`.

Nota: pemerhatian V3 direkod pada 9 Nov 2026 pada data demo, dan pemerhatian V2 dibuat pada Panel V2 sebenar pada hari yang sama sebagai Admin Pusat (hanya baca; tiada apa-apa disimpan). Banyak senarai V3 kecil atau kosong kerana data demo; ini bukan ralat. Angka V2 tidak dibandingkan.

---

# Bahagian 1: Admin Pusat (aliran Panel admin.prestasiplus.cloud)

Sumber: aplikasi Panel V2 (aplikasi berasingan pada subdomain admin, bukan menu `/admin` lama), dilihat terus pada pelayar. Panel boleh dimasuki oleh tiga peranan: Admin Pusat, Admin Sekolah dan Pegawai PPD. Pegawai PPD tidak diuji di sini.

**Had pemerhatian V2:** hanya akaun Admin Pusat V2 tersedia. Paparan Admin Sekolah di Panel V2 tidak dilihat; jangkaan untuk Admin Sekolah diambil daripada kod Panel (bukan paparan sebenar). Set Builder V2 tidak dapat dibuka (tiada pautan set komposit dijumpai pada senarai pertama; satu cubaan URL bagi kertas 360 memberi 404), jadi kes Set Builder berdasarkan kod Panel dan bukan paparan.

Di V3, Admin Pusat guna portal `/admin/...`. Admin Sekolah guna portal berasingan `/admin-sekolah/...` dan **tidak boleh** membuka `/admin/...` (skrin "403 Akses Ditolak"). Jadi satu skrin Panel yang dikongsi dua peranan dipetakan kepada dua skrin V3.

Semua URL V3 bermula dengan `http://localhost:5194`.

## 1.1 Jadual liputan

Menu sisi Panel V2 untuk Admin Pusat: Papan Pemuka, Analitik, Pengguna, Sekolah, Kandungan SPM, Question Studio. (Tanda Karangan tiada dalam menu sisi Admin Pusat tetapi halamannya boleh dibuka melalui URL; ia untuk kakitangan sekolah.)

| No | Menu Panel (URL Panel) | Siapa | Menu V3 | URL V3 | Keadaan di V3 | Perbandingan V2 vs V3 | Kes ujian |
|---|---|---|---|---|---|---|---|
| 1 | Papan Pemuka (`/`): 3 kad (Pelajar, Guru, Sekolah) | Pusat | Harian > Dashboard | `/admin` | Berfungsi | Beza: V3 lebih lengkap (kad Soalan Aktif, Subjek, Battle Arena, Tindakan Pantas, Taburan Status). Kad Guru dan Sekolah berasingan tiada; jumlah Pelajar ada di kad "Pengguna" | PNL-01.1 |
| 1b | Papan Pemuka, sekolah sendiri | Sekolah | Dashboard | `/admin-sekolah` | Berfungsi | Beza: V3 menambah kod sekolah, kelas, ringkasan prestasi. (V2 Admin Sekolah tidak dilihat) | PNL-01.2 |
| 2 | Analitik (`/analitik`) | Pusat | Analitik > Analitik; Command Center | `/admin/analytics`, `/admin/command-center` | Berfungsi | Beza: V2 satu halaman (kad Sekolah, Pelajar Aktif, Soalan Dijawab, Ketepatan; Trend Mingguan; Sekolah Teratas; Pelajar Teratas Minggu Ini; Mood Pelajar; Laporan Soalan Baru/Selesai). V3 sebar pada dua skrin; kad **Laporan Soalan** tiada (ada di `/admin/question-reports`) | PNL-02.1 |
| 2b | Analitik, sekolah sendiri | Sekolah | Statistik Penggunaan; Laporan Aktiviti | `/admin-sekolah/statistik-penggunaan`, `/admin-sekolah/laporan-aktiviti` | Berfungsi | Beza: skrin V3 berlainan daripada Panel. (V2 Admin Sekolah tidak dilihat) | PNL-02.2 |
| 3 | Pengguna (`/pengguna`): notis kelulusan, kad peranan, cari, peranan, Aktifkan | Pusat | Pengguna > Senarai Pengguna | `/admin/users` | Berfungsi | Beza: V3 lebih banyak (penapis Sekolah dan Status, lajur Telefon dan Tarikh, Tambah, Edit, Padam, Nyahaktifkan, Import). V2 hanya baca dan Aktifkan; V2 ada butang **Set Semula** | PNL-03.1, 03.2 |
| 3b | Pengguna, sekolah sendiri | Sekolah | Senarai Pelajar; Senarai Guru | `/admin-sekolah/pelajar`, `/admin-sekolah/guru` | Berfungsi | Beza: V3 dua senarai berasingan; tiada paparan Admin Sekolah lain. (V2 Admin Sekolah tidak dilihat) | PNL-03.3 |
| 4 | Sekolah (`/sekolah`): 3 kad, jadual dengan Kod Daftar, Aktifkan/Nyahaktifkan | Pusat | Pengguna > Sekolah | `/admin/schools` | Berfungsi | Beza: V3 menambah Cari, Negeri, Jenis, Tambah Sekolah, Edit; lajur Daerah. Lajur **Kod Daftar** tiada | PNL-04.1 |
| 4b | Sekolah: **Tukar kod pendaftaran** | Pusat | (tiada) | `/admin/schools` | Tiada | Tiada di V3 (V2: butang "Tukar kod pendaftaran" pada setiap baris) | PNL-04.2 |
| 4c | Sekolah, sekolah sendiri | Sekolah | Dashboard | `/admin-sekolah` | Separa | Beza: V3 tunjuk "Kod: DEMO001" pada tajuk, tidak jelas sama ada kod pendaftaran. (V2 Admin Sekolah tidak dilihat) | PNL-04.3 |
| 5 | Kandungan SPM, hub (`/spm`): 6 kad | Pusat | Soalan > SPM | `/admin/spm` | Berfungsi | Beza: enam kad sama. V3 menambah pautan "lihat sisi pelajar"; V2 hanya "Buka senarai". V2 ada lencana **Flag OFF** pada Kertas Subjektif dan Latih Tubi; V3 tiada | PNL-05.1 |
| 5b | Kandungan SPM: Admin Sekolah dihalang | Sekolah | - | `/admin/spm` | Ditolak (403) | Sama (jangkaan daripada kod Panel) | PNL-05.2 |
| 6 | Laluan Databank (`/spm/databank`) | Pusat | Kad Databank | `/admin/spm/databank` | Berfungsi | Sama: penapis Subjek, Status, Cari teks, Tapis; V2 ada **Set Semula**, V3 tidak. Lajur V2: Tajuk, Status, Perhatian, Tindakan (Pratonton, Sunting) | PNL-06.1 |
| 7 | Sunting soalan (`/spm/soalan/{q}/sunting`) | Pusat | Sunting pada Databank | `/admin/spm/soalan/ID/sunting` | Berfungsi | Beza: V2 ada Teks soalan, **Rajah / Gambar (Buang gambar)**, A-D, Status ("Diluluskan (dipaparkan kepada pelajar)"), Simpan, Batal. V3 ada Teks soalan, A-D, Pilihan jawapan, **Penjelasan**, amaran "belum lengkap"; tiada Rajah/Gambar | PNL-06.2 |
| 8 | Pratonton soalan (`/spm/soalan/{q}/pratonton`) | Pusat | Pratonton pada Databank | `/admin/studio/questions/ID/preview` | Berfungsi | Beza: V2 halaman baca sahaja "Pratonton (baca sahaja)" dengan tanda ✓ pada jawapan betul dan bahagian "Maklumat". V3 membuka editor Studio pada tab Pratonton | PNL-06.3 |
| 9 | Laluan Tracking A (`/spm/tracking-a`) | Pusat | Kad Tracking A | `/admin/spm/tracking-a` | Berfungsi | Beza: lajur Tajuk, Status, Perhatian, Tindakan sama, amaran "Hanya N daripada 40 soalan". V3 menambah butang **Tambah Set** (tiada di V2) | PNL-07.1 |
| 10 | Sunting set Tracking A (`/spm/tracking-a/{set}/sunting`) | Pusat | Sunting | `/admin/spm/tracking-a/ID/sunting` | Separa | Beza: V2 ada **Isi set**, tukar, buang, penanda "diarkib / Tidak disajikan kepada pelajar", panel "Soalan tersedia untuk <subjek>" dan editor "Sunting Soalan" sebaris. V3 ada tukar, buang, Naik, Turun, Simpan; **Isi set** dan panel kolam tiada; pengepala "50 / 34" | PNL-07.2 |
| 11 | Laluan Subjektif (`/spm/subjektif`) | Pusat | Kad Subjektif | `/admin/spm/subjektif` | Berfungsi | Sama: penapis Subjek dan Status, jadual dengan Sunting | PNL-08.1 |
| 12 | Editor "Skema & Rubrik Pemarkahan" (`/spm/subjektif/{q}/sunting`) | Pusat | Sunting pada Subjektif | `/admin/studio/questions/ID/sunting`; paparan `/admin/structured-questions/ID` | Separa | Beza: V2 ada setiap bahagian dengan "Skema (ayat penuh)" dan "Poin Rubrik" (Tambah; "Kosongkan baris untuk membuang poin itu"), butang "Simpan Skema & Rubrik". V3 membuka editor Studio umum; paparan berstruktur baca sahaja. Poin rubrik tiada | PNL-08.2 |
| 13 | Laluan Bijak SPM (`/spm/simulasi`) | Pusat | Kad Bijak SPM | `/admin/spm/simulasi` | Berfungsi | Beza: V2 baris tunjuk "#id · Subjek · N soalan", status, Salin dan Sunting. V3 menambah **Pratonton** | PNL-09.1 |
| 14 | Semak kertas simulasi (`/spm/simulasi-paper/{p}/review`) | Pusat | Sunting pada Bijak SPM | `/admin/spm/kertas/ID` | Berfungsi | Beza: V2 ada Kemas kini metadata (Tajuk, Tempoh, Kod kertas kulit, Arahan kulit kertas), Bahan rujukan kulit kertas, "Isu import (N)", "Belum boleh diterbitkan", Bahagian A/B/C (Sunting bahagian, petikan, soalan), Tambah bahagian, Terbitkan, "Salin untuk sunting". V3 ada Tajuk, Tahun kertas, Simpan, Tambah panel, senarai masalah blueprint, Terbitkan, Salin set, Pratonton sebagai pelajar; tiada Isu import dan Sunting petikan | PNL-09.2 |
| 15 | Laluan Kertas (`/spm/kertas`) | Pusat | Soalan > Kertas Subjektif | `/admin/kertas-subjektif` | Berfungsi | Sama: kad Jumlah Kertas, Diterbitkan, Ada Skema; penapis Subjek, Kertas, Status; Baharu. V2 lajur Tajuk, Negeri, Tahun, Halaman dan Sunting, Sembunyikan, Padam; V3 tiada baris (0 kertas) jadi tindakan baris tidak disahkan. `/admin/spm/kertas` V3 dialihkan ke Set Builder | PNL-10.1 |
| 16 | Laluan Latih Tubi (`/spm/latih-tubi`) | Pusat | Kad Latih Tubi | `/admin/spm/latih-tubi` | Berfungsi | Sama: senarai sama seperti Databank (Pratonton, Sunting). V2 ada lencana Flag OFF pada hub | PNL-11.1 |
| 17 | Kontrak Simulasi (`/spm/kontrak`) | Pusat | Butang Kontrak pada Set Builder | `/admin/spm/kontrak`, `/admin/spm/kontrak/MAT/1` | Berfungsi | Beza: V2 satu halaman, setiap kontrak lipat dengan medan Kod Kertas, Tempoh, Jumlah Markah, Sumber (Draf Spec / Spec Disahkan), Boleh tanda auto, Nota, Bahagian, Simpan, Padam kontrak, serta Baharu. V3 senarai dan editor pada halaman berasingan, tambah Pratonton Kolam dan Pengesahan | PNL-12.1 |
| 18 | Question Studio, senarai (`/studio`) | Pusat | Soalan > Bank Soalan (Studio) | `/admin/studio` | Berfungsi | Beza: V2 kad Draft, Reviewed, Approved, Archived (BI); penapis Subjek, Status, Tahun, Negeri, Kertas, Jenis; lajur No., Soalan, Kertas, Status; Pratonton, Edit, Sembunyikan; butang "Cipta di Studio". V3 label BM (Draf, Menunggu Semakan, Diterbitkan, Diarkibkan), tambah Cari, Tingkatan, DSKP, Cipta baharu | PNL-13.1 |
| 19 | Studio: pratonton, sunting (`/studio/preview/{q}`, `/studio/{q}/edit`) | Pusat | Pratonton, Edit | `/admin/studio/questions/ID/preview`, `/sunting` | Berfungsi | Tidak dilihat di V2 (tidak dibuka kerana soalan sebenar). Jangkaan daripada kod Panel: editor untuk soalan mudah sahaja | PNL-13.2 |
| 20 | Studio: Arkib / Sembunyikan | Pusat | Sembunyikan | `/admin/studio` | Berfungsi | Sama (butang Sembunyikan ada pada kedua-dua; tindakan tidak ditekan di V2) | PNL-13.3 |
| 21 | Studio: Set Builder (`/studio/sets/{p}/builder`) | Pusat | Soalan > Set Builder | `/admin/studio/sets`, `/admin/studio/sets/ID/builder` | Berfungsi | Tidak dapat dibandingkan: Set Builder V2 tidak dapat dibuka. V3: Bank Soalan dan Set dalam satu halaman, `bank` dan `documents` berasingan 404 | PNL-13.4 |
| 22 | Tanda Karangan (`/spm/tanda-karangan`) | Sekolah (dan Pusat) | (tiada) | `/admin/spm/tanda-karangan`, `/admin-sekolah/tanda-karangan` | Tiada | Tiada di V3. V2: halaman "Tanda Karangan (semakan AI)" dengan kiraan menunggu, nota "AI mencadangkan markah ... markah hanya dikira setelah cikgu mengesahkan" dan keadaan kosong "Tiada karangan menunggu semakan." | PNL-14.1 |

### Ringkasan liputan

| Perkara | Bilangan |
|---|---|
| Baris fungsi Panel (termasuk varian Admin Sekolah) | 28 |
| Berfungsi di V3 | 22 |
| Separa (baris 4c, 10, 12) | 3 |
| Tiada (baris 4b tukar kod pendaftaran, baris 22 Tanda Karangan) | 2 |
| Ditolak 403 yang betul (baris 5b) | 1 |
| Perbandingan: Sama | 6 (baris 5b, 6, 11, 15, 16, 20; baris 6, 15, 16 ada beza kecil) |
| Perbandingan: Beza | 17 |
| Perbandingan: Tiada di V3 | 2 (baris 4b, 22) |
| Tidak dapat dibandingkan (skrin V2 tidak dibuka) | 2 (baris 19, 21) |
| Blok kes ujian | 30 |

---

## 1.2 Kes ujian

Prasyarat umum: sudah log masuk dengan akaun yang dinyatakan dalam setiap kes. "Beza diperhatikan" ialah perkara V3 yang berbeza daripada Panel V2 pada hari semakan; jika anda mahu V3 sama dengan V2, tandakan Gagal.

### Papan Pemuka

**PNL-01.1 Papan Pemuka Admin Pusat**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah:
  1. Log masuk. Anda dibawa ke Dashboard (`/admin`).
  2. Lihat kad jumlah (Pengguna dengan bilangan Pelajar, Subjek, Battle Arena).
  3. Klik **Tambah Soalan Baru**, kembali; klik **Import & Semakan Soalan**.
- Jangkaan: V2 menunjukkan tiga kad sahaja, iaitu Pelajar ("Jumlah pelajar berdaftar"), Guru ("Jumlah guru berdaftar") dan Sekolah ("Jumlah sekolah berdaftar"), seluruh negara. V3 mesti memaparkan sekurang-kurangnya jumlah pelajar, guru dan sekolah itu; pautan pantas membuka skrin betul.
- Beza diperhatikan: V3 menambah banyak kad dan Tindakan Pantas, tetapi kad Guru dan kad Sekolah berasingan tiada.
- Rujukan: Panel `/`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-01.2 Papan Pemuka Admin Sekolah**
- Akaun: Admin Sekolah. Prasyarat: tiada.
- Langkah:
  1. Log masuk. Anda dibawa ke `/admin-sekolah`.
  2. Baca tajuk sekolah, jumlah Pelajar, Guru dan Kelas Aktif.
  3. Cuba buka `http://localhost:5194/admin`.
- Jangkaan: angka hanya untuk sekolah sendiri (SMK Demo Satu); bilangan sekolah ialah 1. Membuka `/admin` membawa kembali ke `/admin-sekolah` (tiada angka seluruh negara).
- Beza diperhatikan: V3 menambah kod sekolah, ringkasan prestasi, amaran awal. Paparan V2 Admin Sekolah tidak dilihat; jangkaan daripada kod.
- Rujukan: Panel `/`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

### Analitik

**PNL-02.1 Analitik Admin Pusat**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah:
  1. Klik **Analitik**. Lihat kad Sekolah, Pelajar, Soalan Dijawab, Ketepatan, carta trend dan Top Sekolah.
  2. Klik **Command Center**. Lihat Top Sekolah, Top Pelajar Minggu Ini dan Mood Pelajar.
  3. Buka `/admin/question-reports` untuk laporan soalan.
- Jangkaan: V2 satu halaman "Analitik" dengan teks "Angka keseluruhan platform.": kad Sekolah (dengan "langganan aktif"), Pelajar Aktif ("N daripada N pelajar berdaftar"), Soalan Dijawab ("N hari ini, N minggu ini"), Ketepatan ("purata jawapan betul, semua masa"); Trend Mingguan (7 hari); Sekolah Teratas (5); Pelajar Teratas Minggu Ini; Mood Pelajar (Gembira, Okay, Sedih, Tertekan); Laporan Soalan (Baru, Selesai). V3 mesti ada angka yang sama merentas skrinnya.
- Beza diperhatikan: V3 tidak satu halaman; kad Laporan Soalan tiada di Analitik atau Command Center.
- Rujukan: Panel `/analitik`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-02.2 Analitik Admin Sekolah**
- Akaun: Admin Sekolah. Prasyarat: tiada.
- Langkah:
  1. Klik **Statistik Penggunaan**. Tukar tempoh Hari Ini, 7 Hari, 30 Hari.
  2. Klik **Laporan Aktiviti**. Tukar tempoh 7 Hari, 30 Hari, 3 Bulan.
  3. Buka `/admin/analytics`.
- Jangkaan (daripada kod Panel): angka untuk sekolah sendiri sahaja ("Angka untuk sekolah anda sahaja."), jadual Sekolah Teratas disembunyikan. `/admin/analytics` memaparkan "403 Akses Ditolak".
- Beza diperhatikan: skrin V3 berlainan daripada Panel; paparan V2 Admin Sekolah tidak dilihat.
- Rujukan: Panel `/analitik`.
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
- Jangkaan: V2 memaparkan kad peranan (Pelajar, Guru, Admin Sekolah, Pegawai PPD, Admin), penapis Peranan, kotak "Nama, emel atau username...", butang **Tapis** dan **Set Semula**, "Senarai Pengguna N pengguna", jadual Nama, Emel / Username, Peranan, Sekolah, Status, Tindakan dengan paginasi. Senarai berubah mengikut penapis.
- Beza diperhatikan: V3 menambah penapis Sekolah dan Status, lajur Telefon dan Tarikh, butang Tambah, Import, Edit, Padam; butang Set Semula tiada.
- Rujukan: Panel `/pengguna`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-03.2 Pengguna Admin Pusat: aktifkan akaun**
- Akaun: Admin Pusat. Prasyarat: ada akaun menunggu kelulusan (notis di atas senarai).
- Langkah:
  1. Pada `/admin/users` baca notis "akaun menunggu kelulusan, belum boleh log masuk" dan klik **Semak & luluskan**.
  2. Pilih satu akaun tidak aktif (rekaan) dan aktifkannya.
- Jangkaan: V2 menunjukkan notis dengan pautan "Semak & luluskan" yang menapis senarai (peranan Guru). Pada baris tidak aktif ada butang **Aktifkan** (pada baris aktif, Tindakan ialah "—"). Selepas aktif, mesej "Akaun ... telah diaktifkan, pengguna kini boleh log masuk" dan notis berkurang.
- Beza diperhatikan: V3 menapis kepada semua akaun tidak aktif, bukan peranan Guru sahaja; tindakan aktifkan melalui menu tindakan atau Edit.
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
- Jangkaan (daripada kod Panel): hanya Pelajar, Guru dan Admin Sekolah sekolah sendiri; Admin Pusat dan Pegawai PPD tidak kelihatan. `/admin/users` memaparkan "403 Akses Ditolak".
- Beza diperhatikan: V3 mempunyai dua senarai berasingan; paparan V2 Admin Sekolah tidak dilihat.
- Rujukan: Panel `/pengguna`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

### Sekolah

**PNL-04.1 Sekolah Admin Pusat: senarai dan togol aktif**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah:
  1. Klik **Sekolah**. Lihat kad Jumlah Sekolah, Aktif, Tidak Aktif.
  2. Pilih Negeri **Selangor**, klik **Cari**.
  3. Klik **Nyahaktif** pada "SK Demo Dua", sahkan, kemudian aktifkan semula melalui **Edit** > "Sekolah Aktif".
- Jangkaan: V2 memaparkan kad Jumlah Sekolah, Aktif, Tidak Aktif, "Senarai Sekolah N sekolah" dan jadual Nama Sekolah, Kod, Kod Daftar, Pelajar, Guru, Status, Tindakan (Aktifkan atau Nyahaktifkan). Status berubah selepas tindakan dan boleh dipulihkan.
- Beza diperhatikan: V3 menambah Cari, Negeri, Jenis, Tambah Sekolah, Edit dan lajur Daerah; lajur **Kod Daftar** tiada.
- Rujukan: Panel `/sekolah/{school}/toggle`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-04.2 Sekolah Admin Pusat: tukar kod pendaftaran**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Buka `/admin/schools`. 2. Cari lajur "Kod Daftar" dan butang "Tukar kod pendaftaran". 3. Buka **Edit** satu sekolah dan cari medan yang sama.
- Jangkaan: V2 memaparkan Kod Daftar (8 aksara) pada setiap baris dan butang **Tukar kod pendaftaran** dengan pengesahan "Tukar kod pendaftaran?". Jangan tukar kod pada data demo kecuali dipulihkan.
- Beza diperhatikan: **Tiada di V3** (tiada lajur dan butang).
- Rujukan: Panel `/sekolah/{school}/join-code`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-04.3 Sekolah Admin Sekolah: lihat kod sekolah sendiri**
- Akaun: Admin Sekolah. Prasyarat: tiada.
- Langkah: 1. Pada `/admin-sekolah` lihat tajuk sekolah dan "Kod: DEMO001". 2. Cari kod pendaftaran (kod yang murid atau guru guna untuk menyertai sekolah) di Dashboard, Senarai Pelajar dan Senarai Guru. 3. Buka `/admin/schools`.
- Jangkaan (daripada kod Panel): Admin Sekolah nampak sekolah sendiri sahaja dengan Kod Daftar, tanpa butang tukar kod (hanya Admin Pusat). `/admin/schools` memaparkan "403 Akses Ditolak".
- Beza diperhatikan: V3 hanya menunjuk "Kod: DEMO001"; catat dalam Komen sama ada itu kod pendaftaran sebenar. Paparan V2 Admin Sekolah tidak dilihat.
- Rujukan: Panel `/sekolah`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

### Kandungan SPM (Admin Pusat sahaja)

**PNL-05.1 Hub SPM**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Klik **SPM** (bawah Soalan). 2. Baca enam kad. 3. Klik **Buka senarai** pada setiap kad, kembali melalui "Semua laluan SPM" atau pautan Kandungan SPM. 4. Cari lencana "Flag OFF".
- Jangkaan: V2 ada enam kad: Databank Soalan, Tracking A, Subjektif, Bijak SPM, Kertas Subjektif, Latih Tubi. Teks atas: "Setiap kad ialah satu laluan yang pelajar boleh buka. Nombor merah menunjukkan berapa banyak item yang perlu diperiksa." Setiap kad ada nombor dan status ("Semua elok", "N set tidak lengkap", atau "N tiada skema — tidak disajikan") dan pautan "Buka senarai". Kad Kertas Subjektif dan Latih Tubi ada lencana **Flag OFF**.
- Beza diperhatikan: V3 menambah pautan "lihat sisi pelajar"; lencana Flag OFF tiada.
- Rujukan: Panel `/spm`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-05.2 Admin Sekolah dihalang daripada Kandungan SPM**
- Akaun: Admin Sekolah. Prasyarat: tiada.
- Langkah: 1. Cari menu SPM dan Studio dalam menu sisi. 2. Buka `/admin/spm`, `/admin/spm/tracking-a` dan `/admin/studio`.
- Jangkaan (daripada kod Panel): tiada menu SPM atau Studio untuk Admin Sekolah; ketiga-tiga URL ditolak ("403 Akses Ditolak" di V3).
- Rujukan: Panel (SPM dan Studio untuk Admin Pusat sahaja).
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-06.1 Databank Soalan: senarai dan tapis**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Buka Databank Soalan daripada hub. 2. Pilih Subjek **Sejarah** dan Status **Diluluskan**, klik **Tapis**. 3. Taip 3 aksara dalam **Cari**, klik **Tapis**. 4. Klik halaman seterusnya.
- Jangkaan: V2: tajuk "Databank Soalan, Bank soalan objektif SPM mengikut subjek. N item"; penapis Subjek, Status (Diluluskan, Draf, Menunggu, Ditolak), "Teks soalan...", butang Tapis dan Set Semula; jadual Tajuk, Status, Perhatian, Tindakan (Pratonton, Sunting); paginasi.
- Beza diperhatikan: butang Set Semula tiada di V3; V3 menambah pautan "lihat sisi pelajar".
- Rujukan: Panel `/spm/databank`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-06.2 Sunting soalan SPM**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Pada Databank, klik **Sunting** pada satu soalan. 2. Lihat medan. 3. Tambah perkataan "UJI" pada Teks soalan, klik **Simpan**. 4. Buka semula, buang "UJI", simpan.
- Jangkaan: V2 ada Teks soalan, Rajah / Gambar (dengan "Buang gambar"), pilihan A, B, C, D, Status ("Diluluskan (dipaparkan kepada pelajar)"), butang Simpan dan Batal, serta pautan "Kembali ke Databank". Perubahan disimpan; medan wajib kosong ditolak.
- Beza diperhatikan: V3 ada medan Penjelasan, Pilihan jawapan dan amaran "belum lengkap"; **Rajah / Gambar** dan medan Status tiada pada borang ini.
- Rujukan: Panel `/spm/soalan/{q}/sunting`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-06.3 Pratonton soalan**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Pada Databank, klik **Pratonton** pada satu soalan. 2. Semak paparan, kemudian klik tab lain jika ada.
- Jangkaan: V2: halaman "Pratonton (baca sahaja)" dengan status soalan, pilihan A-D (jawapan betul bertanda ✓) dan bahagian "Maklumat". Tiada apa-apa boleh disunting.
- Beza diperhatikan: V3 membuka editor Studio (tab Pratonton, Tag, Kertas, Rangsangan, Sub-bahagian) dan memaparkan "Dilihat murid di N daripada N aktiviti".
- Rujukan: Panel `/spm/soalan/{q}/pratonton`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-07.1 Tracking A: senarai**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Buka Tracking A daripada hub. 2. Tapis Subjek **Sains**, klik **Tapis**. 3. Baca setiap baris. 4. Cari butang **Tambah Set**.
- Jangkaan: V2: "Tracking A, Set objektif penuh dan lane bahasa. N item"; penapis Subjek, Status; jadual Tajuk ("Subjek · 2026 Set N"), Status (ramalan), Perhatian (contoh "Hanya 8 daripada 40 soalan — N tersedia untuk diisi"), Tindakan (Sunting). Tiada butang Tambah Set.
- Beza diperhatikan: V3 menambah butang **Tambah Set**.
- Rujukan: Panel `/spm/tracking-a`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-07.2 Tracking A: sunting set (isi, tukar, buang, simpan)**
- Akaun: Admin Pusat. Prasyarat: tiada. Guna satu set sahaja dan pulihkan selepas ujian.
- Langkah: 1. Klik **Sunting** pada satu set. 2. Baca pengepala dan sasaran. 3. Cari butang **Isi set**. 4. Klik **tukar** pada satu soalan, pilih soalan lain. 5. Cuba **Naik** dan **Turun**. 6. Klik **buang** pada satu soalan. 7. Klik **Simpan**.
- Jangkaan: V2: halaman "Soalan dalam set" dengan soalan bernombor; setiap baris ada **tukar** dan **buang**; soalan diarkib bertanda "diarkib, Tidak disajikan kepada pelajar"; butang **Isi set**; panel "Soalan tersedia untuk <subjek>: N"; panel "Sunting Soalan, Pilih soalan untuk menyunting" untuk suntingan sebaris. Set sasaran 40 soalan objektif.
- Beza diperhatikan: V3 ada **Naik**, **Turun** dan **Simpan** (tiada di V2); **Isi set**, panel kolam soalan tersedia dan penyunting sebaris tiada; pengepala menunjukkan "50 / 34".
- Rujukan: Panel `/spm/tracking-a/{set}/sunting`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-08.1 Laluan Subjektif**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Buka Subjektif daripada hub. 2. Pilih Subjek **Matematik Tambahan** dan Status, klik **Tapis**.
- Jangkaan: V2: "Subjektif, Soalan berstruktur dan esei. N item"; penapis Subjek dan Status (Diluluskan, Draf, Menunggu, Ditolak); jadual Tajuk, Status, Perhatian, Tindakan; baris "#id · Subjek · N bahagian · N markah" dengan **Sunting**.
- Beza diperhatikan: V3 menambah pautan "lihat sisi pelajar".
- Rujukan: Panel `/spm/subjektif`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-08.2 Editor skema dan rubrik**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Pada laluan Subjektif, klik **Sunting** pada satu soalan. 2. Cari "Skema (ayat penuh)" dan "Poin Rubrik" setiap bahagian. 3. Cari butang **Tambah** dan nota "Kosongkan baris untuk membuang poin itu". 4. Buka `/admin/structured-questions` dan klik **Lihat** pada soalan yang sama.
- Jangkaan: V2: halaman "Skema & Rubrik Pemarkahan" dengan maklumat soalan (subjek, tingkatan, markah), setiap bahagian ada Skema (ayat penuh) dan Poin Rubrik boleh ditambah atau dibuang, dan butang "Simpan Skema & Rubrik".
- Beza diperhatikan: **V3 tiada editor ini**. Sunting membuka editor Studio umum; paparan berstruktur hanya baca (sub-soalan dan "Jawapan Model").
- Rujukan: Panel `/spm/subjektif/{q}/sunting`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-09.1 Laluan Bijak SPM (Simulasi)**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Buka Bijak SPM daripada hub. 2. Pilih Status **Draf**, klik **Tapis**. 3. Klik **Pratonton** pada satu kertas, kembali. 4. Klik **Salin** pada satu kertas (kemudian padam salinan itu daripada Set Builder).
- Jangkaan: V2: "Bijak SPM, Kertas SPM penuh dalam format sebenar. N item"; baris "#id · Subjek · N soalan", status (Draft) dan tindakan **Salin** dan **Sunting**; penapis Subjek dan Status. Salinan baharu muncul dengan akhiran "(Salinan)".
- Beza diperhatikan: V3 menambah **Pratonton**.
- Rujukan: Panel `/spm/simulasi`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-09.2 Semak kertas simulasi dan terbit**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Pada laluan Simulasi, klik **Sunting** pada satu kertas draf. 2. Baca "Isu import" dan senarai masalah. 3. Lihat butang **Terbitkan**. 4. Ubah **Tajuk** dan klik **Simpan**, kemudian pulihkan.
- Jangkaan: V2: bahagian "Kemas kini metadata" (Tajuk, Tempoh (minit), Kod kertas (kulit), Arahan kulit kertas, Simpan), "Bahan rujukan (kulit kertas)" dengan "Sunting bahan rujukan", panel "Isu import (N)" dan "Belum boleh diterbitkan", senarai "Kontrak Simulasi", bahagian A, B, C (Sunting bahagian, Sunting petikan, Sunting soalan), "Tambah bahagian", seksyen Penerbitan (**Terbitkan**, **Salin untuk sunting**). Terbitkan dihalang selagi ada isu. Jangan terbitkan kertas demo.
- Beza diperhatikan: V3 ada Tajuk, Tahun kertas, "Tambah panel", Salin set, Pratonton sebagai pelajar dan mesej "Kertas belum boleh diterbitkan: selesaikan N perkara"; **Isu import**, Kod kertas kulit, Arahan kulit dan Sunting petikan tiada.
- Rujukan: Panel `/spm/simulasi-paper/{paper}/review`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-10.1 Kertas (senarai dan baharu)**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Klik **Kertas Subjektif** dalam menu. 2. Tukar penapis Subjek, Kertas (2/3/4) dan Status, klik **Tapis**. 3. Klik **Baharu** (lihat borang; batal jika tidak perlu). 4. Pada hub SPM, buka kad Kertas Subjektif.
- Jangkaan: V2: kad Jumlah Kertas, Diterbitkan, Ada Skema; penapis Subjek, Kertas, Status, Cari; "Senarai Kertas" dengan butang **Baharu**; jadual Tajuk, Negeri, Tahun, Halaman, Tindakan (**Sunting**, **Sembunyikan**, **Padam**); paginasi.
- Beza diperhatikan: sama pada struktur. V3 tiada baris pada data demo (0 kertas), jadi tindakan baris tidak dapat diuji sehingga ada kertas.
- Rujukan: Panel `/spm/kertas`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-11.1 Latih Tubi**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Buka Latih Tubi daripada hub. 2. Pilih Subjek, taip 3 aksara dalam **Cari**, klik **Tapis**.
- Jangkaan: V2: "Latih Tubi, Latihan ikut topik dan bab. N item", penapis Subjek dan Status, Tapis, Set Semula; jadual Tajuk, Status, Perhatian, Tindakan (Pratonton, Sunting). Pada hub kad ini bertanda Flag OFF.
- Beza diperhatikan: Set Semula dan lencana Flag OFF tiada di V3.
- Rujukan: Panel `/spm/latih-tubi`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-12.1 Kontrak Simulasi**
- Akaun: Admin Pusat. Prasyarat: tiada. Jangan simpan perubahan kontrak demo.
- Langkah: 1. Buka `/admin/spm/kontrak`. 2. Buka kontrak **Matematik Kertas 1**. 3. Baca amaran "Kontrak dikongsi". 4. Lihat Maklumat Kertas, Bahagian A, Pengesahan. 5. Klik **Pratonton Kolam**.
- Jangkaan: V2: satu halaman "Kontrak Simulasi" dengan amaran "Kontrak dikongsi ... mengubah pintu terbitan untuk SEMUA kertas subjek tersebut", "Senarai Kontrak N kontrak", butang **Baharu**; setiap kontrak (subjek × kertas) boleh dibuka dengan medan Kod Kertas, Tempoh (minit), Jumlah Markah, Sumber (Draf Spec / Spec Disahkan), Boleh tanda auto, Nota, Bahagian (Tambah Bahagian, Jawab Semua / Pilih N), **Simpan** dan **Padam kontrak**.
- Beza diperhatikan: V3 memisahkan senarai dan editor, menambah Pengesahan dan Pratonton Kolam (butang Jana Draf Kertas dilumpuhkan jika kolam tidak cukup).
- Rujukan: Panel `/spm/kontrak`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

### Question Studio (Admin Pusat sahaja)

**PNL-13.1 Studio: senarai dan penapis**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Klik **Bank Soalan (Studio)**. 2. Klik kad status **Draf**, kemudian **Diterbitkan**. 3. Pilih Subjek **Matematik**, Tingkatan 4, klik **Tapis**. 4. Tukar "25 / halaman" dan buka halaman 2.
- Jangkaan: V2: empat kiraan status (Draft, Reviewed, Approved, Archived), butang "Cipta di Studio", penapis Subjek, Status, Tahun, Negeri, Kertas, Jenis, Tapis, Set Semula, jadual No., Soalan, Kertas, Status, Tindakan (Pratonton, Edit, Sembunyikan) dan paginasi.
- Beza diperhatikan: V3 label BM (Draf, Menunggu Semakan, Diterbitkan, Diarkibkan), menambah Cari, Tingkatan dan DSKP; Set Semula tiada.
- Rujukan: Panel `/studio`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-13.2 Studio: pratonton dan sunting soalan**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Klik **Pratonton** pada satu soalan. 2. Kembali, klik **Edit**. 3. Lihat langkah 1 Tag, 2 Kertas, 3 Rangsangan, 4 Sub-bahagian. 4. Ubah Kesukaran, simpan, kemudian pulihkan.
- Jangkaan (daripada kod Panel; skrin V2 tidak dibuka): pratonton memaparkan soalan; editor menyimpan soalan "mudah" sahaja dan soalan kompleks diarahkan ke Studio penuh.
- Beza diperhatikan: tidak dibandingkan secara visual.
- Rujukan: Panel `/studio/preview/{q}`, `/studio/{q}/edit`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-13.3 Studio: arkib dan pulih**
- Akaun: Admin Pusat. Prasyarat: guna soalan Draf contoh (kad Draf, 1 soalan).
- Langkah: 1. Klik **Sembunyikan** pada soalan itu. 2. Klik kad **Diarkibkan**. 3. Buka soalan itu dan klik **Pulihkan ke draf**.
- Jangkaan: V2 ada butang Sembunyikan pada setiap baris. Soalan berpindah ke Diarkibkan dan "Tidak dipapar kepada pelajar"; selepas Pulihkan ia kembali Draf.
- Rujukan: Panel `/studio/{q}/archive`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

**PNL-13.4 Studio: Set Builder**
- Akaun: Admin Pusat. Prasyarat: tiada.
- Langkah: 1. Klik **Set Builder**. 2. Klik **Buka** pada satu set draf. 3. Dalam tab **Bank Soalan**, cari soalan, pilih Bahagian A dan klik **Tambah**. 4. Dalam tab **Set**, klik **Naik soalan 1**, **Turun soalan 1**, kemudian **Buang soalan**. 5. Klik **Simpan bahagian**. 6. Klik **Semak Kertas**.
- Jangkaan (daripada kod Panel; skrin V2 tidak dapat dibuka): Bank, set dan dokumen dalam Panel; Terbitkan dilumpuhkan selagi ada masalah blueprint.
- Beza diperhatikan: V3 tiada halaman `bank` atau `documents` berasingan (404).
- Rujukan: Panel `/studio/sets/{paper}/builder`.
- Keputusan: ☐ Lulus ☐ Gagal
- Komen:

### Tanda Karangan

**PNL-14.1 Tanda Karangan (semakan markah AI)**
- Akaun: Admin Sekolah (kemudian Admin Pusat). Prasyarat: ada jawapan karangan yang menunggu semakan (jika tiada, hanya keadaan kosong dapat dilihat).
- Langkah: 1. Cari **Tanda Karangan** dalam menu sisi. 2. Buka `/admin-sekolah/tanda-karangan` dan `/admin/spm/tanda-karangan`.
- Jangkaan: V2: halaman "Tanda Karangan (semakan AI)" dengan kiraan menunggu, nota "AI mencadangkan markah untuk setiap karangan berdasarkan skema. Sahkan atau laraskan — markah hanya dikira setelah cikgu mengesahkan." Setiap karangan: Jawapan pelajar, Skema, Justifikasi AI, Markah muktamad, butang **Sahkan**. Keadaan kosong: "Tiada karangan menunggu semakan." Menu sisi hanya untuk kakitangan sekolah.
- Beza diperhatikan: **Tiada di V3**: tiada menu dan kedua-dua URL 404. Rekod sebagai Gagal selagi tiada.
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
