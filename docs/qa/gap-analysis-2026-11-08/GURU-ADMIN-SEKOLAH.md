# Analisis Jurang: Portal GURU dan ADMIN SEKOLAH (V3-local lawan V2 dan V1), 8 Nov 2026

Tarikh ujian: 2026-11-08. Pembanding: `docs/qa/gap-analysis-2026-11-04/GURU-ADMIN-SEKOLAH.md` (4 Nov). Sumber peranan/baris: `docs/Matriks-Akses-Peranan .xlsx` melalui `docs/ROLES-MATRIX-LINES.md` dan baseline 4 Nov (fail xlsx tidak dibuka terus kerana Python tiada; senarai baris 1.0 diambil daripada baseline). PRD: `docs/prd/r1/20-guru-admin-sekolah.md` (bahagian 5 XS-1..8, 6.2b daftar jurang) dan `40-cross-cutting.md` (AC-CHAIN).

## 0. Kaedah dan had (baca dahulu)

- **V3-local** (http://localhost:5194, HEAD b50fa8d41): diuji secara hidup di lorong 2 dengan akaun `guru@demo.test` dan `adminsekolah@demo.test`. Setiap laluan menu dibuka, teks dibaca, limpahan mendatar (scrollWidth lawan clientWidth) diukur pada 375, 768 dan 1280 px untuk 26 laluan Guru dan 19 laluan Admin Sekolah: **0 px limpahan pada semua**. Tangkapan skrin: `.evidence/gap-2026-11-08/guru-adminsekolah/` (4 fail). Hanya pandangan; satu-satunya "klik" ialah modal Badges / Ramalan SPM / Kelas di Command Center Guru dan eksport CSV headcount (muat turun fail).
- **V1 dan V2 tidak dibuka dalam pelayar langsung sama sekali.** Arahan pemimpin (kemas kini wajib, elak sekatan Cloudflare): kod dan pelayan dahulu, pelayar langsung terakhir. Jadi lajur V1/V2 di bawah datang daripada kod V2 (`D:\Dev Projects\prestasiplus-reference\backend\routes\web.php`, `ImpersonateController.php`), PRD bahagian 1.3 dan "Screen specification (from V2)", dan baseline 4 Nov. Tiada log masuk V1/V2, tiada pertanyaan pelayan pengeluaran V2 (agregat data tidak disemak). Tiada Cloudflare ditemui kerana tiada akses dibuat.
- **V2 paparan guru:** `ImpersonateController` (V2) memang membenarkan admin pusat menyamar sebagai pengguna bukan staf (termasuk guru) dan admin sekolah menyamar pengguna sekolahnya sendiri. Tetapi ia `POST /admin/users/{user}/impersonate` yang menulis sesi dan `audit_logs`, bukan suis paparan baca sahaja. Ia tidak digunakan (peraturan: live hanya baca). Paparan guru V2 dinilai daripada kod dan bukti 4 Nov.
- Data demo kecil. Setiap "kosong" ditanda **(data)** jika fungsi wujud tetapi seed tiada data, atau **(fungsi)** jika fungsi hilang. Data demo berubah semasa ujian (Soalan Dijawab 80 menjadi 85, 5 jawapan baharu hari ini) kerana lorong lain menggunakan pangkalan yang sama; angka di bawah dibaca pada waktu yang dinyatakan.
- Tidak diuji: akaun `guruadmin@demo.test`; klik Remedial dan Evaluate di Command Center (menulis data); "Hantar Kertas kepada Admin", import soalan CSV, cipta kelas/pelajar/guru (menulis; hanya borang dilihat); Log Keluar (sesi dibersihkan melalui kosongkan kuki, bukan butang); butiran pelajar Guru `/guru/pelajar/:id` (ID percubaan tidak sah, laluan tidak dijumpai); sub-halaman headcount sebagai Admin Sekolah; satu ralat konsol hadir pada setiap muatan halaman (tidak dikenal pasti puncanya, kemungkinan `GET /api/config/support` 404 seperti PRD 6.2b #19).

Keterangan: ✅ berfungsi dan setara; ⚠️ berfungsi tetapi ada kekurangan; ❌ tidak berfungsi. Perubahan sejak 4 Nov: **ditutup** (jurang lama sudah selesai), **masih** (belum selesai), **baru** (rosak baharu), **tiada** (tiada jurang pada kedua-dua tarikh).

## 1. Ringkasan (scoreboard)

### Guru (20 baris matriks: A1-A5, 1-11, 41-44; 1.0 = 19 baris, semua kecuali A4)

| Ukuran | ✅ | ⚠️ | ❌ | Jumlah |
|---|---|---|---|---|
| 8 Nov, baris 1.0 | 14 | 5 | 0 | 19 |
| 8 Nov, semua baris | 15 | 5 | 0 | 20 |
| 4 Nov (dikira semula daripada jadual baseline, anggaran), semua baris | 12 | 6 | 2 (Analitik #5, Laporan Mingguan #43) | 20 |

Ditutup sejak 4 Nov: #43 Laporan Mingguan (kritikal, kini laporan penuh), #5 Analitik Adaptif (menu kini `/analitik/kelas`), A1 Profil Guru (`/guru/profil/edit` kini wujud dengan Bio, No KP, Subjek Utama, Kelayakan, Pengalaman, Profil Awam), #3 sub-halaman Headcount (summary, unjuran, settings, export, edit semuanya berisi). Masih: Misi Harian Guru (404), Kod QR kelas (ciri tambahan V3).

### Admin Sekolah (23 baris: A1-A5, 1-7, 10, 11, 45-53; 1.0 = 18 baris: A5, 1, 3, 4, 5, 6, 7, 10, 11, 45-53; baseline menulis "18 modul + A5", kiraan baris sebenar ialah 17 + A5)

| Ukuran | ✅ | ⚠️ | ❌ | Jumlah |
|---|---|---|---|---|
| 8 Nov, baris 1.0 | 10 | 8 | 0 | 18 |
| 8 Nov, semua baris | 14 | 9 | 0 | 23 |
| 4 Nov (dikira semula, anggaran), semua baris | 9 | 10 | 4 (Headcount #3, Analitik #5, Kirkpatrick #11, Sekolah Bersaing #45) | 23 |

Ditutup sejak 4 Nov: #3 Headcount (senarai kini 2 headcount sekolah), #5 Analitik Adaptif (`/analitik/kelas` dibuka untuk Admin Sekolah), #11 Kirkpatrick (7 skrin boleh dicapai di `/admin-sekolah/kirkpatrick/*`), #45 Sekolah Bersaing (papan terisi, 1 sekolah), #46 Statistik Penggunaan (ada data hari ini), #50 Laporan Bulanan (jadual 12 bulan dan prestasi subjek kini kelihatan), #49 Amaran Awal (pelajar tanpa data tidak lagi Merah, "13 pelajar belum mula"), #51 penapis Kelas/Tingkatan. Masih: Import Pelajar pukal, DSKP Heatmap tanpa data, angka tidak sepadan antara skrin (jenis baharu: 20 lawan 17).

Responsif (375 / 768 / 1280): tiada limpahan mendatar pada semua laluan di atas; navigasi bawah mudah alih (Dashboard, Kelas, Command Center, Penilaian, Lagi) boleh dicapai. Tiada kecacatan susun atur ditemui, jadi tiada bug High responsif.

## 2. Jadual GURU

Bukti: `P:` = laluan V3-local yang dibuka; `SS` = tangkapan skrin dalam `.evidence/gap-2026-11-08/guru-adminsekolah/`.

| # | Modul (1.0?) | V1 | V2 (kod) | V3-local 8 Nov | Verdik | Kekurangan | Sejak 4 Nov | Bukti |
|---|---|---|---|---|---|---|---|---|
| A1 | Profil Saya (Ya) | Hero + `/guru/profil/edit` | `guru/profil-edit`, `profil-awam` | `/profile` hero + Kemaskini Profil; `/guru/profil/edit` ada Maklumat Peribadi, Bio, No KP, Sekolah, Maklumat Profesional (Subjek Utama, Kelayakan, Pengalaman), Profil Awam (Salin Link, Lihat) | ✅ | Simpan tidak diuji (menulis) | ditutup | P:/profile, /guru/profil/edit |
| A2 | Tetapan Peribadi (Ya) | Mod Rohani | Ada | `/tetapan` dibuka, kandungan 1.6k aksara | ✅ | Simpan tidak diuji | tiada | P:/tetapan |
| A3 | Panduan (Ya) | Tab ikut peranan | Ada | `/panduan` dibuka (tanpa shell), pilih peranan Pelajar/Guru/Ibu Bapa/Admin Sekolah/PPD | ✅ | Pemilihan tab awal ikut peranan tidak diuji; 1 ralat konsol | tiada | P:/panduan |
| A4 | Tiket Bantuan (tidak, skop penuh) | Ada | Ada | `/pusat-tuisyen/tiket`: Jumlah tiket 0, Tiket Baru, penapis status, empty state "Tiada tiket lagi." | ✅ | Kosong ialah **(data)** | tiada | P:/pusat-tuisyen/tiket |
| A5 | Log Keluar (Ya) | Ada | Ada | Item akaun wujud dalam kod; tidak diklik | ⚠️ | Tidak disahkan (tidak diuji) | tiada | prototype-scope.ts |
| 1 | Command Center (Ya) | Skrin gelap, 4 KPI, 6 butang, Kirkpatrick, Mood, Feed | `guru/command-center` | 4 KPI, Jeda, Skrin Penuh, 6 butang. Badges, Ramalan SPM (6 pelajar, GPS 4.33) dan Kelas modal berisi; Rekod pergi ke `/guru/remedial-progress` (berfungsi, 0 set **(data)**). Nilai: 7 pelajar, 65 jawapan, 63% | ⚠️ | KPI "Ketepatan Purata" berlabel "keseluruhan sekolah" tetapi nilai skop kelas (63%), PRD FR-GUR-1-2 minta "keseluruhan kelas anda"; "GPS Sekolah --" walaupun headcount kelas wujud (3.45 pada AS); Remedial/Evaluate tidak diuji | masih (label), ditutup (butang) | P:/guru/command-center; SS guru-cc-768.png |
| 2 | Dashboard Guru (Ya) | Mula Di Sini, 4 statistik, Tindakan Pantas | `guru/dashboard` | Mula Di Sini 3 langkah (Kelas Saya, Pelajar Saya, Monitoring), jubin Cipta Kelas Baru, Sumbang Soalan, Lihat Pelajar, **Edit Profil Guru (kini ada sasaran)**, Kelas Saya | ⚠️ | `/guru/misi-harian` dan `/guru/misi-harian/cipta` = 404 Halaman Tidak Dijumpai, sedangkan PRD R1-GUR-2b menyatakan Misi Harian dihantar dengan 1.0; V2 ada (`TeacherDailyController`). Tiada pautan Misi Harian di dashboard (disorok) | Edit Profil: ditutup; Misi Harian: masih | P:/guru, /guru/misi-harian; V2 web.php:1673-1675 |
| 3 | Headcount (Ya) | Senarai, Dashboard, Buat Baru, Auto-Setup | `guru/headcount*` | Senarai 2 headcount (Manual 6 murid, Auto 7 murid), Dashboard, Buat Baru, Auto-Setup; `/headcount/1` jadual TOV/OTR/AR/ETR; summary, unjuran, settings, edit semuanya berisi; eksport CSV memuat turun | ✅ | Sub-halaman bukan lagi shell (PRD 6.2b #4 ditutup). "Jumlah 7" lawan kelas BM berstatus "6 murid": kelas berbeza, bukan percanggahan | ditutup | P:/headcount, /headcount/1/* |
| 4 | Prestasi (Ya) | `/prestasi/kelas` | `guru/prestasi` | Kad kelas, Prestasi Mengikut Subjek (Matematik 63%, 65 soalan), Pelajar Terbaik, Lihat Prestasi → papan kelas | ✅ | Prestasi kelas BM (`/prestasi/kelas/1`) papar 0 sesi/0 soalan/0% sedangkan Laporan papar "6/7 pernah buat latihan": jawapan pelajar ialah Matematik pada kelas lain **(data, skop kelas)**; perlu dipastikan XS-2 terpakai mengikut kelas | tiada | P:/prestasi/kelas, /prestasi/kelas/1 |
| 5 | Analitik Adaptif (Ya) | Menu → analitik pelajar | `/analitik/kelas` | Menu → `/analitik/kelas`: penapis Kelas/Subjek/Risiko, 4 KPI (7 pelajar, 63%, 2 berisiko, 3 baik), jadual dengan Trend, Unjuran, Risiko, Lihat Analitik, Rekod Intervensi | ✅ | Tiada | ditutup (dari Tinggi) | P:/analitik/kelas; SS guru-analitik-kelas-375.png |
| 6 | Analisa Item (+ Analisis Item) (Ya) | `/analisa-item`, `/guru/analisis-item` | `analisa-item-kelas`, `analisis-item` | Pilih kelas → analisa kelas; Analisis Item dengan penapis subjek | ✅ | Kelas BM "Tiada Data Lagi" **(data)** | tiada | P:/analisa-item, /guru/analisis-item |
| 7 | Video (Ya) | Senarai + kategori | Ada | 3 video, penapis kategori, Tambah Video | ✅ | Tiada | tiada | P:/video |
| 8 | Kelas Saya (Ya) | Kad, Cipta Kelas, Kod QR | `guru/kelas*` | 2 kelas, kod kelas, Kod QR, Cipta Kelas Baru (borang dengan Subjek dan Tahap) | ✅ | Kod kelas dan Kod QR ialah ciri V3 sahaja; PRD 6.2b #21 minta dibuang (C7). Simpan tidak diuji | masih | P:/guru/kelas, /guru/kelas/cipta |
| 9 | Soalan by Chapter (Ya) | Sistematik bab demi bab | `guru/practice-chapter` | Hanya Matematik, 1 bab, 5 soalan | ⚠️ | Liputan nipis **(data)**; tiada tindakan khusus guru | masih | P:/practice/chapter |
| 10 | Monitoring (Ya) | `/guru/monitoring` | `guru/monitoring` | Skop sekolah sendiri: 17 pelajar, 7 aktif, 85 soalan, 4 guru, tab Pelajar/Guru/Tracking/Cemerlang/Cadangan, PDF, CSV, Refresh | ✅ | Angka 17 pelajar dan 4 guru bercanggah dengan skrin lain (lihat bahagian 4) | tiada | P:/guru/monitoring |
| 11 | Kirkpatrick (Ya) | Ringkasan, T1-T4, Rantaian, Intervensi | `guru/kirkpatrick*` | Semua 7 skrin berisi dalam tab bar; Ringkasan 17/85/1-dari-4/62% | ✅ | Tahap 4 "Belum Ada Data" **(data)**; angka 17 lawan 7 pelajar Command Center | tiada | P:/guru/kirkpatrick/*; SS guru-kirkpatrick-1280.png |
| 41 | Pelajar Saya (Ya) | Tab, Cipta Pelajar | `guru/pelajar` | 7 pelajar dengan Skor Purata, Terakhir Aktif; tab Pelajar Sekolah / Pelajar Saya; Cipta Pelajar (borang) | ✅ | Butiran `/guru/pelajar/:id` tidak diuji | tiada | P:/guru/pelajar, /guru/pelajar/cipta |
| 42 | Laporan (Ya) | Statistik | `guru/laporan` | Penapis kelas/tempoh, kad Pernah Login/Latihan/Jumlah Aktiviti/Pecahan Skor, trend | ✅ | "Jumlah Aktiviti 30 hari" lawan jawapan hari ini perlu diselaraskan XS-4 (angka berubah antara bacaan) | tiada | P:/guru/laporan |
| 43 | Laporan Mingguan (Ya) | 403 pada admin | `guru/laporan-mingguan` | Menu → `/guru/laporan-mingguan-kelas`: pilih kelas, Cetak, 4 kad (5 jawapan, 1 aktif, 0 meningkat, 1 subjek perhatian), Top Performers, Paling Meningkat, Subjek Perlu Perhatian | ✅ | Tiada; mesej kosong BM betul apabila tiada data | **ditutup** (dari Kritikal) | P:/guru/laporan-mingguan-kelas; SS guru-laporan-mingguan-375.png |
| 44 | Sumbang Soalan (Ya) | Statistik, Import, Hantar Kertas | `guru/sumbang`, `soalan-guru`, `soalan-hub` | Statistik 4 kad (semua 0), alat Soalan & Rujukan (kosong), Soalan Berstruktur (3.5k aksara), borang Cipta Soalan, tiada teks "belum tersedia" | ⚠️ | Statistik 0 **(data)**; Hantar Kertas, import CSV tidak diuji (menulis); PRD 6.2b #5 tidak dapat disahkan tutup | tidak dapat ditentukan | P:/guru/soalan, /guru/soalan-guru, /guru/soalan/cipta |

## 3. Jadual ADMIN SEKOLAH

V2 tiada portal sendiri: ia memakai `/admin/*` terskop sekolah (PRD 1.3); baris 3-7, 45-47, 49, 53 tiada di V2 untuk admin sekolah (V2 `/headcount` 403, `/prestasi`, `/analitik/kelas`, `/analisa-item` redirect ke `/admin`), rujukan ialah V1/PRINCIPLE.

| # | Modul (1.0?) | V1 | V2 (kod) | V3-local 8 Nov | Verdik | Kekurangan | Sejak 4 Nov | Bukti |
|---|---|---|---|---|---|---|---|---|
| A1 | Profil Saya (tidak) | Hero | Ada | `/profile`: hero + kad Sekolah (SMK Demo Satu, kod DEMO001, PPD Petaling, Selangor) | ✅ | Tiada | tiada | P:/profile |
| A2 | Tetapan Peribadi (tidak) | Ada | Ada | `/tetapan` dibuka | ✅ | Simpan tidak diuji | tiada | P:/tetapan |
| A3 | Panduan (tidak) | Tab Admin Sekolah | Ada | `/panduan` dibuka | ✅ | Tab awal tidak diuji | tiada | P:/panduan |
| A4 | Tiket Bantuan (tidak) | Ada | Ada | Senarai 0 tiket, Tiket Baru | ✅ | Kosong **(data)** | tiada | P:/pusat-tuisyen/tiket |
| A5 | Log Keluar (Ya) | Ada | Ada | Tidak diklik | ⚠️ | Tidak disahkan | tiada | - |
| 1 | Command Center (Ya) | Alias CC dengan skop sekolah | `admin/command-center` + `daily-activity` | 4 KPI (1 Sekolah Berdaftar, 20 Pelajar, 7 aktif, 85 Soalan, 62%), Aktiviti Hari Ini, Pembetulan, Kirkpatrick T1-T4, Top Pelajar, Mood, Live Feed; sub Aktiviti Harian (Hari Ini/Minggu/Bulan, heatmap jam) | ⚠️ | Kad "Sekolah Berdaftar 1 / langganan aktif" kekal (kad peringkat platform), sedangkan Dashboard sekolah "Belum Ada Langganan": percanggahan label langganan; "T4 GPS 0.000" sedangkan GPS Sekolah 3.45 pada Dashboard | masih (dari Sederhana), pelajar 16 kini 20 sepadan | P:/admin-sekolah/command-center, .../daily-activity |
| 2 | Dashboard (tidak) | Banner, 4 kad, Ringkasan Prestasi | `admin/dashboard` (V2 papar dashboard soalan nasional, kecacatan V2) | Banner sekolah, 20 pelajar / 3 guru / 7 kelas, GPS 3.45, Amaran Awal 0/1/6, 62%, Tingkatan, Taburan Gred, Perutusan Lihat semua (kini berfungsi) | ⚠️ | Amaran Awal "7 murid dinilai" lawan 20 pelajar; "Tingkatan 5 0%" (1 pelajar, tiada jawapan) | masih | P:/admin-sekolah |
| 3 | Headcount (Ya) | Senarai/dashboard | `guru/headcount*` | Senarai 2 headcount (Guru Demo, Auto/Manual) + Dashboard "13 murid, 1 On Track" | ✅ | Paparan butiran sebagai Admin Sekolah (baca sahaja?) tidak diuji; Dashboard sekolah papar "11 entri headcount" tetapi Headcount papar 13 murid: XS-6(d) perlu satu definisi | **ditutup** (dari Tinggi) | P:/headcount, /headcount/dashboard |
| 4 | Prestasi (Ya) | Dashboard, Tingkatan, Kelas | `admin/performance` | `/prestasi/sekolah`: 7 kelas, 20 murid, 3 guru, 85 soalan, 62%, GPS 3.45, Taburan Gred (11 rekod); `/prestasi/tingkatan` dan `/prestasi/kelas` berisi | ✅ | Tingkatan 1-5 jumlah murid 2+1+1+14+1 = 19, jumlah 20 (seorang tanpa kelas): perlu label | tiada | P:/prestasi/* |
| 5 | Analitik Adaptif (Ya) | `/analitik/pelajar` | `/analitik/kelas` | Menu → `/analitik/kelas` dengan semua 7 kelas sekolah, jadual risiko | ✅ | Tiada | **ditutup** (dari Tinggi) | P:/analitik/kelas |
| 6 | Analisa Item (Ya) | `/analisa-item` | Ada | Sekolah: Pelajar 20, Jawapan 85, Soalan Diuji 5, 62%, GPS 3.45, profil kesukaran, prestasi subjek | ✅ | Padan dengan Dashboard/Prestasi (20/85/62%) | ditutup | P:/analisa-item/sekolah |
| 7 | Video (Ya) | Senarai | Ada | 3 video, penapis | ✅ | Tiada | tiada | P:/video |
| 10 | Monitoring (Ya) | Alias | `admin/monitoring` | Tempoh, 17 pelajar, 7 aktif, 41.2%, 85 soalan, **4 guru (1 login, 25%)**, tab Analisis Sekolah/Guru/Tracking/Cemerlang/Cadangan, PDF, CSV | ⚠️ | XS-1: 17 (label "Pelajar Berdaftar") lawan 20 di Senarai/Dashboard/CC; XS-3: 4 guru lawan 3 di Senarai Guru/Dashboard/Laporan Aktiviti (PRD XS-3 menetapkan aktif dan diluluskan sahaja) | masih (dari Sederhana) | P:/admin-sekolah/monitoring |
| 11 | Kirkpatrick (Ya) | Ringkasan sahaja | `admin/kirkpatrick*` (7 skrin) | Ringkasan + Tahap 1-4, Rantaian Impak, Intervensi semuanya dibuka di `/admin-sekolah/kirkpatrick/*`, "Lihat detail" berfungsi, tiada penapis Semua Sekolah | ⚠️ | Label "17 Pelajar Berdaftar (T4/T5)" dan "17 Pelajar T4/T5" keras; PRD melarang label T4/T5 dan nilai mesti 20; Tahap 4 "0 rekod" **(data)** | sebahagian ditutup (dari Tinggi) | P:/admin-sekolah/kirkpatrick/* |
| 45 | Sekolah Bersaing (Ya) | Papan 20 sekolah | `sekolah-bersaing` | Papan Pemimpin: 1 sekolah (SMK Demo Satu, Selangor, 60%, 7 pelajar) | ✅ | Hanya 1 sekolah kerana seed demo ada 1 sekolah **(data)**; ketepatan 60% lawan 62% pada skrin lain (mod berbeza, perlu label); tiada penyorotan sekolah sendiri diuji | **ditutup** (dari Tinggi) | P:/sekolah-bersaing |
| 46 | Statistik Penggunaan (Ya) | Nama sahaja | Dikecualikan | Hari Ini/7/30 Hari, 20 pelajar, 3 guru, 1 aktif, 5 soalan, 20%, jadual mod latihan (Latihan 1 sesi) | ✅ | Padan Laporan Aktiviti dan Laporan Bulanan Nov (5 soalan) | ditutup | P:/admin-sekolah/statistik-penggunaan |
| 47 | DSKP Heatmap (Ya) | Tiada kandungan | Tiada | Penapis Subjek dan Tingkatan 4/5, grid Bidang x SP | ⚠️ | Semua sel "-" **(data)**; legenda dipaparkan berganda ("Lemah, Mahir, Mahir, Sederhana, Lemah") kekal | masih | P:/admin-sekolah/dskp-heatmap |
| 48 | Laporan Aktiviti (Ya) | 404 | `admin/laporan` | 7H/30H/3B, tab Overview/Guru (3)/Murid (20), Murid Pernah Login 40%, Cikgu 33%, Trend Aktiviti | ✅ | Paksi trend sebahagian besar 0 **(data)**; tab Guru/Murid tidak diklik | tiada | P:/admin-sekolah/laporan-aktiviti |
| 49 | Amaran Awal (Ya) | `/amaran/sekolah` | `guru/amaran` | Pil tingkatan, 7 jumlah, 0/1/6, "13 pelajar belum mula (tiada data latihan)", Taburan Risiko, Keberkesanan Intervensi, Ringkasan Eksekutif, CSV, Analisis Risiko Mengikut Subjek | ⚠️ | `/amaran/ringkasan-eksekutif` papar 0 / 2 (29%) / 5 (71%) manakala `/amaran/sekolah` papar 0 / 1 / 6: dua nombor untuk perkara sama; 7 daripada 20 dinilai | **separa ditutup** (amaran palsu 17/17 hilang, kini percanggahan baharu) | P:/amaran/sekolah, /amaran/ringkasan-eksekutif |
| 50 | Laporan Bulanan (Ya) | 500 | `admin/laporan-eksekutif` | Laporan November 2026, pilih bulan lepas, 4 kad, Statistik Bulanan 12 bulan (Sept 85 soalan, Nov 5), Prestasi Mengikut Subjek | ✅ | Padan jumlah 85 | **ditutup** | P:/admin-sekolah/laporan-bulanan |
| 51 | Senarai Pelajar (Ya) | Jadual, import pukal | `admin/users`, `import-students` | 22 pengguna (20 aktif + 2 menunggu), penapis Status/Tingkatan/Kelas, Eksport CSV, Tambah Pelajar, Edit; `/admin-sekolah/pelajar/baru` borang | ⚠️ | **Import Pelajar pukal tiada: `/admin-sekolah/pelajar/import` = 404** (PRD 6.2b #13, AC-CHAIN-8 memerlukan import 31 pelajar ditolak "Kuota penuh!") | penapis ditutup; import masih | P:/admin-sekolah/pelajar, /admin-sekolah/pelajar/import |
| 52 | Senarai Guru (Ya) | Jadual | `admin/users` | 3 guru, Eksport CSV, Cipta Pengguna, Edit, "Guru Menunggu" (0, mesej BM betul) | ✅ | Tiada Subjek/Kelayakan pada senarai (V2 pun tiada) | tiada | P:/admin-sekolah/guru, .../guru/menunggu |
| 53 | Kelas Sekolah (Ya) | Tidak diketahui | Tiada | 7 kelas, carian, penapis Tingkatan, jadual Subjek/Tingkatan/Guru/Murid | ⚠️ | Hanya baca; tiada lihat murid/Cipta Kelas (baris AS-53 dalam PRD tidak dibaca secara terperinci, sahkan keperluan) | masih | P:/admin-sekolah/kelas |

## 4. Konsistensi nombor merentas skrin (XS-1..8, AC-XS-1, AC-CHAIN)

Dibaca 8 Nov ~11:00-11:15 MYT, sekolah demo SMK Demo Satu.

| Ukuran | Nilai sepadan | Nilai bercanggah | Status |
|---|---|---|---|
| XS-1 Pelajar | 20: Dashboard, Senarai Pelajar, CC, Prestasi, Analisa Item, Statistik, Laporan Aktiviti | **17**: Monitoring (Guru dan AS), Kirkpatrick (label "T4/T5") | ❌ AC-XS-1 gagal; nombor lama 17/16/13 kini 20/17 |
| XS-3 Guru | 3: Senarai Guru, Dashboard, Statistik, Laporan Aktiviti | **4**: Monitoring "Guru Berdaftar", Kirkpatrick "1/4 Guru Aktif" | ❌ |
| XS-4 Soalan Dijawab | 85: Dashboard, Prestasi, CC, Analisa Item, Monitoring, Kirkpatrick, Laporan Bulanan (jumlah) | tiada (dahulu 122/30/36) | ✅ **ditutup** |
| XS-5 Ketepatan | 62%: Dashboard, Prestasi, CC, Kirkpatrick, Analisa Item, Laporan Bulanan | Sekolah Bersaing 60% (ukuran berbeza, tidak berlabel), Skor Purata Kirkpatrick 60% (nama berasingan, dibenarkan) | ✅ (+ label) |
| Amaran Awal | 0/1/6: Dashboard, `/amaran/sekolah` | 0/2/5: Ringkasan Eksekutif | ❌ baharu |
| Entri headcount (XS-6d) | 11: Dashboard, Prestasi, Analisa Item | Headcount Dashboard 13 murid; senarai 2 headcount | ⚠️ perlu satu definisi dan label |
| Guru "Kelas Aktif" (XS-6e) | 7 kelas: Dashboard, Kelas Sekolah, Prestasi | - | ✅ |
| Guru (skop kelas) | CC 7 pelajar/65 jawapan/63% = Prestasi Kelas | CC label "keseluruhan sekolah" | ⚠️ label |

AC-CHAIN-5 (headcount dari key-in ke semua paparan) hanya diperiksa sebahagian (paparan sahaja, tiada key-in); AC-CHAIN-4/6/7/8 tidak dijalankan (menulis data).

## 5. Jurang teratas (diperingkat)

| No | Jurang | Peranan / baris | Keterukan | Jenis |
|---|---|---|---|---|
| 1 | Angka bercanggah antara skrin: Pelajar 20 lawan 17 (Monitoring, Kirkpatrick "T4/T5"), Guru 3 lawan 4 (Monitoring/Kirkpatrick); AC-XS-1 dan XS-3 gagal; label "T4/T5" keras dilarang oleh PRD | AS #10, #11; Guru #10, #11 | High | fungsi (definisi) |
| 2 | Import Pelajar pukal tiada (`/admin-sekolah/pelajar/import` = 404); AC-CHAIN-8 tidak boleh dijalankan | AS #51 | High | fungsi |
| 3 | Amaran Awal dua nombor: `/amaran/sekolah` 0/1/6 lawan Ringkasan Eksekutif 0/2/5; hanya 7 daripada 20 pelajar dinilai | AS #49 (+Dashboard #2) | Medium | fungsi (definisi) |
| 4 | Misi Harian Guru 404 (PRD R1-GUR-2b dihantar dengan 1.0; V2 ada `guru/misi-harian`, `/cipta`) | Guru #2 | Medium | fungsi |
| 5 | DSKP Heatmap semua "-" dan legenda berganda | AS #47 | Medium | data + kecacatan visual |
| 6 | Command Center: label "keseluruhan sekolah" untuk angka kelas; GPS "--" / T4 GPS 0.000 sedangkan headcount ada GPS 3.45; kad "Sekolah Berdaftar/langganan aktif" bercanggah dengan "Belum Ada Langganan" | Guru #1, AS #1, #2 | Medium | fungsi (label) |
| 7 | Entri headcount: "11 entri" lawan 13 murid pada Headcount Dashboard (XS-6d belum satu definisi) | AS #2, #3, #4 | Low-Medium | definisi |
| 8 | Kod kelas dan Kod QR (V3 sahaja, PRD C7 minta buang) masih ada | Guru #8 | Low | skop |
| 9 | Kelas Sekolah hanya baca (tiada drill/cipta); Prestasi kelas BM 0 soalan lawan Laporan "6/7 pernah latihan" (skop kelas, perlu label) | AS #53, Guru #4 | Low | fungsi/definisi |
| 10 | Data demo nipis menyembunyikan fungsi: Soalan by Chapter 1 subjek, Sekolah Bersaing 1 sekolah, Sumbang Soalan 0, Kirkpatrick Tahap 4, Laporan Aktiviti trend 0 | pelbagai | Low | data |

Tiada jurang Kritikal. Masalah 4 Nov yang ditutup: Laporan Mingguan Guru (Kritikal), Analitik Adaptif Guru dan AS, Kirkpatrick AS (6 sub-skrin), Headcount AS kosong, Sekolah Bersaing kosong, Profil Guru, Laporan Bulanan nipis, Amaran Awal palsu 17/17, Statistik Penggunaan 0, penapis Senarai Pelajar.

## 6. Cadangan kemaskini PRD

Fail `docs/prd/r1/20-guru-admin-sekolah.md` (jangan disunting oleh saya; pemimpin yang menerapkan):

| Fail / bahagian | Teks semasa | Cadangan | Bukti |
|---|---|---|---|
| 20 §6.2b baris 1, 2, 4, 7, 8, 9, 11, 12, 14, 15, 16 | Dinyatakan jurang terbuka | Tandakan **Ditutup (disahkan 8 Nov, V3-local b50fa8d41)**: Laporan Mingguan Guru, menu ke `/guru/laporan-mingguan-kelas`, sub-halaman Headcount, `/guru/profil/edit`, Analitik AS dan Guru, Kirkpatrick AS 7 skrin, Headcount AS (skop sekolah), Sekolah Bersaing, Perutusan "Lihat semua", Amaran tanpa data bukan Merah, Laporan Bulanan subjek | Bahagian 2 dan 3 laporan ini |
| 20 §6.2b baris 13 | "Import Pelajar unreachable" | Kekal terbuka: `/admin-sekolah/pelajar/import` = 404; tindakan perlu ada pada Senarai Pelajar | AS #51 |
| 20 §6.2b baris 21 | Kod kelas/QR V3-sahaja, akan dibuang | Kekal terbuka, tiada perubahan | Guru #8 |
| 20 R1-GUR-2b | Misi Harian dihantar dengan 1.0 | Tambah "Semasa 8 Nov: `/guru/misi-harian` 404 di V3-local" (jurang baharu dalam daftar 6.2b) | Guru #2; V2 web.php:1673-1675 |
| 20 AC-XS-1 | Mismatch semasa pelajar 17/16/13, guru 3/4, soalan 122/30/36, ketepatan 57.9/73.3/33.3% | Kemas kini kepada mismatch 8 Nov: pelajar 20 lawan 17 (Monitoring, Kirkpatrick), guru 3 lawan 4 (Monitoring, Kirkpatrick); soalan dan ketepatan sudah sepadan (85, 62%) | bahagian 4 |
| 20 R1-AS-49 | Ringkasan Eksekutif mesti sama dengan skrin Amaran | Tambah AC: jumlah Hijau/Kuning/Merah pada Ringkasan Eksekutif = `/amaran/sekolah` (kini 2/5 lawan 1/6) | AS #49 |
| 20 §1.3 | V2 impersonate tidak disebut sebagai cara melihat portal guru | Tambah: V2 `ImpersonateController` membenarkan admin pusat menyamar guru (POST, tulis `audit_logs`), jadi rujukan paparan guru V2 boleh dijana tanpa akaun guru, tetapi bukan baca sahaja | V2 `app/Http/Controllers/Admin/ImpersonateController.php`, web.php:758 |
| 20 R1-GUR-1 FR-GUR-1-2 | "Ketepatan Purata = keseluruhan kelas anda" | Sahkan salin label CC; V3 kini papar "keseluruhan sekolah" | Guru #1 |

## 7. Tidak dapat disahkan

- V1 dan V2 secara langsung (tiada pelayar langsung digunakan, ikut arahan elak Cloudflare); lajur V1/V2 hanya daripada kod V2, PRD dan baseline. Tiada pertanyaan pelayan V2.
- Tindakan menulis: cipta kelas, cipta pelajar/guru, import, simpan profil/tetapan, Remedial, Evaluate, Hantar Kertas, Log Keluar.
- Akaun `guruadmin@demo.test` (guru + admin sekolah), butiran pelajar Guru, sub-halaman headcount sebagai Admin Sekolah, tab Guru/Murid Laporan Aktiviti, Analisis Risiko Mengikut Subjek (hanya teks dilihat).
- Punca satu ralat konsol pada setiap halaman.
- Xlsx matriks tidak dibuka terus; penanda 1.0 mengikut baseline.

Tangkapan skrin: `D:\Dev Projects\prestasiplus-v3\.evidence\gap-2026-11-08\guru-adminsekolah\` (`guru-laporan-mingguan-375.png`, `guru-analitik-kelas-375.png`, `guru-cc-768.png`, `guru-kirkpatrick-1280.png`).
