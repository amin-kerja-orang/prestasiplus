# Laporan Analisis Jurang (sintesis) — PrestasiPlus V3 lawan V2 dan V1, 8 November 2026

**Skop:** hanya MODUL, CIRI dan FUNGSI (menu, medan, tindakan, langkah, peraturan, keadaan, salinan BM). Bilangan rekod dan data pangkalan data TIDAK dinilai (arahan pemilik produk: pangkalan data UAT mungkin tidak betul).
**Sistem dinilai:** V3-local (`http://localhost:5194`, cabang `feature/v3-bijak-r1`, HEAD `b50fa8d41`, data demo kecil) lawan V2 (prestasiplus.cloud) dan V1 (prestasiplus.my).
**Asas:** `MURID.md`, `GURU-ADMIN-SEKOLAH.md`, `ADMIN-PUSAT.md` (V3-local dilihat langsung; V2/V1 daripada kod V2 dan nota 4 Nov), `LIVE-VERIFY.md` (semakan langsung V2/V1 untuk skrin admin sahaja), `REPO-STATE.md`, `DATA-GAP.md` (latar sahaja). Garis dasar: `docs/qa/gap-analysis-2026-11-04/GAP-ANALYSIS-FULL.md`. **Peraturan keutamaan:** jika `LIVE-VERIFY.md` bercanggah dengan laporan lain, `LIVE-VERIFY.md` menang (ia melihat skrin sebenar).

Penanda bukti dalam laporan ini: **[langsung]** = dilihat pada V2/V1 sebenar (hanya skrin admin pusat); **[kod]** = daripada kod V2, PRD atau nota 4 Nov, tidak dilihat langsung; **[V3]** = dilihat langsung pada V3-local.

---

## 1. Ringkasan eksekutif

**Adakah V3 kini setara V2/V1 dari segi fungsi? Belum, tetapi jaraknya sudah berubah bentuk.**

| Portal | Verdik fungsi 8 Nov | Sebab ringkas |
|---|---|---|
| Murid | **Hampir setara** (tiada lagi modul rosak) | 32 daripada 43 baris ✅, 11 ⚠️, 0 ❌. Baki: Remedial tidak menjana, dua Papan Pendahulu, Kedudukan tanpa kad sendiri, Dashboard tanpa "Pakej SPM Aktif", Heatmap kosong (belum pasti fungsi atau data), serpihan data ujian kelihatan. |
| Guru | **Hampir setara** | 15 daripada 20 ✅, 5 ⚠️, 0 ❌. Baki: Misi Harian 404, label Command Center, angka tidak sepadan. |
| Admin Sekolah | **Hampir setara** | 14 daripada 23 ✅, 9 ⚠️, 0 ❌. Baki: Import Pelajar pukal 404, pelajar 20 lawan 17 dan guru 3 lawan 4, dua jumlah Amaran Awal. |
| Admin Pusat | **Belum setara** | 12 daripada 54 modul diurus penuh; 29 tiada skrin. Seluruh ekonomi pelajar (Gamifikasi, Kedai Hadiah dan tebusan, Kawalan Reward, Permainan, Cabutan), Kawalan Ciri, Tracking A, Dashboard dan analitik/laporan pusat masih 404. |

Mesej utama:
1. **Tiga portal pengguna sudah di ambang.** Daripada 13 masalah teratas 4 Nov: 4 ditutup, 8 separa, 1 masih (bahagian 2). Tiada jurang Kritikal pada portal Murid, Guru atau Admin Sekolah.
2. **Admin Pusat ialah jurang sebenar.** Jalur soalan dan kandungan maju (Sumber Kertas, Kertas Subjektif, Video, Marketplace, Kiriman Guru, satu baris gilir semakan, kontrak "Disahkan" boleh dipilih). Tetapi admin masih tidak boleh mengurus apa yang murid nampak: hadiah, tebusan, gamifikasi, permainan. Satu jurang Kritikal: Kedai Hadiah dan Tebusan Queue (tebusan murid tidak boleh dipenuhi).
3. **Aliran kandungan soalan masih ada kecacatan fungsi sebenar** (Jana set terkunci, CSV tiada lajur DSKP, rangsangan hilang senyap, Topik tidak ditapis mengikut Bab, pengekstrak PDF masih mock) walaupun aliran tamat-ke-tamat F1 kini lulus.
4. **Semakan langsung membetulkan beberapa andaian laporan kod** (bahagian 3, nota pembetulan): hub SPM V2 ialah 5 kad (bukan 6), Tier Config dan Cabaran V2 baca sahaja, tiada skrin admin "Kotak Misteri" atau "Tournament" pada V2/V1, panel `admin.prestasiplus.cloud` tidak wujud (panel kedua ialah Filament).
5. **Had penting:** paparan murid, guru dan admin sekolah V2/V1 tidak dilihat langsung (bahagian 5). Perkataan "setara" untuk tiga portal itu bergantung pada kod V2 dan nota 4 Nov.

### Papan markah (verdik fungsi sahaja)

| Portal | Baris | 8 Nov ✅ / ⚠️ / ❌ | 4 Nov ✅ / ⚠️ / ❌ | Catatan asas |
|---|:-:|:-:|:-:|---|
| Murid, semua baris | 43 | **32 / 11 / 0** | 24 / 13 / 6 | Pengiraan semula dalam `MURID.md`. |
| Murid, lajur 1.0 | 18 | 13 / 5 / 0 | 7 / 7 / 4 | |
| Guru, semua baris | 20 | **15 / 5 / 0** | 12 / 6 / 2 | 4 Nov dikira semula (anggaran). Dua ❌ lama: Analitik #5, Laporan Mingguan #43. |
| Guru, lajur 1.0 | 19 | 14 / 5 / 0 | - | |
| Admin Sekolah, semua baris | 23 | **14 / 9 / 0** | 9 / 10 / 4 | 4 Nov dikira semula (anggaran). Empat ❌ lama: Headcount, Analitik, Kirkpatrick, Sekolah Bersaing. |
| Admin Sekolah, lajur 1.0 | 18 | 10 / 8 / 0 | - | |
| Admin Pusat, 54 modul | 54 | **12 / 9 / 29** (+4 n/a) | 8 / 10 / 32 (+4 n/a) | ✅ = diurus penuh; ⚠️ = separa; ❌ = tiada skrin. Ditambah baru: #9, #10, #32, #41. |
| Admin Pusat, baris 1.0 | 29 | 7 / 5 / 15 (+2 n/a) | 4 / 7 / 16 (+2 n/a) | |
| Item menu dibina (`menu.ts`) | 106 | 46 dibina | 40 dibina | 40 pautan sidebar dalam 8 kumpulan. |

**Pelarasan LIVE-VERIFY kepada Admin Pusat:** daripada 29 modul ❌, sekurang-kurangnya #23 Tournament dan #40 Jemput Ibu Bapa disahkan langsung TIADA skrin admin padanan pada V2/V1 (bukan jurang pariti), dan #34 Pencapaian tidak dikenal pasti [kod]. #35 "Kotak Misteri" sebenarnya modul Kawalan Reward. Jadi jurang pariti sebenar ialah kira-kira 26 daripada 29. Verdik fungsi Admin Pusat tidak berubah.

---

## 2. Apa yang ditutup sejak 4 Nov (13 masalah teratas 4 Nov)

| # | Masalah 4 Nov | Status 8 Nov | Bukti dan baki |
|---|---|---|---|
| 1 | Bijak SPM tiada kertas | **Separa** | [V3] Aliran penuh berfungsi (mula, 6 soalan, Hantar dengan pengesahan, keputusan, Cuba Lagi; 375 px baik). Baki: Tracking A 404; swa-markah Subjektif tidak dapat diuji; terbit kertas penuh baharu tidak dapat diselesaikan (G-04, kolam seed 1 markah). |
| 2 | Soalan tidak dipetakan ke bab/DSKP | **Separa** | [V3] Studio kini menanda Bab, Topik (unit DSKP), SP, TP, aras; Soalan by Chapter berjalan hingga keputusan. Baki: G-02 Topik tidak ditapis mengikut Bab; G-03 soalan terbit tidak muncul di Soalan by Chapter. |
| 3 | Prestasi murid = Dashboard Sekolah (kebocoran data) | **Ditutup** | [V3] "Prestasi 360 - Dashboard Individu"; `/prestasi/sekolah` kini 403 untuk murid. |
| 4 | Murid tiada Headcount, Analisa Item, Laporan Soalan | **Ditutup** | [V3] Ketiga-tiganya halaman sebenar (Headcount ada butiran TOV/OTR/ETR; Laporan Soalan Saya dengan jejak status). |
| 5 | Guru Laporan Mingguan "Akses Ditolak" | **Ditutup** | [V3] `/guru/laporan-mingguan-kelas` penuh (pilih kelas, Cetak, 4 kad, Top Performers, Paling Meningkat). |
| 6 | Aliran import soalan rosak | **Separa** | [V3] PDF kini tamat "Selesai"; Kiriman Guru muncul pada admin; CSV dan manual boleh dihantar. Baki: pengekstrak ialah mock `heuristik-1`; CSV tiada lajur DSKP dan gagal tanpa sebab (G-05); muat naik PDF oleh guru tidak diuji; tab "Kertas Diimport" tiada. |
| 7 | Menu soalan admin berganda; hub SPM 2/6 | **Separa** | [V3] Satu baris gilir (`/admin/spm/semakan` dialih ke Studio) ditutup; hub kini 5 kad (tiada Tracking A). Baki: 9 hingga 10 item pendua menu masih ada. |
| 8 | Admin tiada skrin Gamifikasi, Hadiah, Marketplace, Permainan/Cabutan/Tournament, Kawalan Ciri, Kertas Subjektif, Tracking A | **Masih** (2 daripada 7 ditutup) | [V3] Ditutup: Marketplace (produk dan penjual), Kertas Subjektif (skrin dibuka). Masih 404: Gamifikasi, Kedai Hadiah, Kawalan Reward, Permainan, Cabutan, Tournament, Kawalan Ciri, Tracking A. |
| 9 | Latihan hanya T4-T5; T1-T3 "akan datang" | **Separa (tidak dapat disahkan)** | [V3] Tiada teks "akan datang" pada 46 laluan murid; Latih Tubi memaparkan T1 5 soalan. Tiada akaun demo T1-T3, jadi pintu T1 dan kandungan T1-T3 tidak diuji. |
| 10 | Admin Sekolah: Kirkpatrick 403, Analitik kosong, Headcount kosong, angka bercanggah | **Separa** | [V3] Kirkpatrick 7 skrin, Analitik `/analitik/kelas`, Headcount senarai dan dashboard, Sekolah Bersaing, Statistik, Laporan Bulanan, Amaran tanpa data bukan Merah, penapis Kelas/Tingkatan semuanya ditutup. Baki: angka bercanggah (pelajar 20/17, guru 3/4), Import Pelajar pukal 404. |
| 11 | Struktur soalan rosak (D90, rajah dijadikan soalan) | **Separa** | [V3] Studio F1 lulus dengan rangsangan kongsi (Kumpulan #3 kekal selepas muat semula), pintu terbit menamakan medan yang kurang. Baki: G-01 rangsangan hilang senyap pada Simpan draf. Kelaziman data pindahan ialah soal data, di luar penilaian ini. |
| 12 | Kaedah tambah soalan tidak ikut DSKP | **Separa** | [V3] Borang memilih Topik, SP, TP, aras (bukan taip bebas); pintu terbit menunjuk langkah ("Sila pilih unit DSKP - Langkah 4"). Baki: CSV tiada lajur DSKP (G-05); G-02. |
| 13 | Skrin kertas soalan tidak responsif (tiada "Hantar" di telefon) | **Ditutup** | [V3] Bijak di 375 px: butang Hantar kelihatan pada soalan akhir, 0 px limpahan mendatar pada 46 laluan murid x 3 lebar dan 26+19 laluan guru/admin sekolah. Notasi matematik matriks dan widget pelbagai tidak diuji semula. |

Ringkasan: **4 ditutup, 8 separa, 1 masih**.

---

## 3. Senarai jurang fungsi berperingkat (seluruh sistem)

Kelas: **(a)** modul/skrin tiada, **(b)** fungsi rosak atau tidak lengkap, **(c)** ketidakkonsistenan merentas skrin, **(d)** sisa ujian/demo yang kelihatan kepada pengguna. Kelas **(e)** (disekat oleh data demo nipis sahaja) ada di bawah jadual dan tidak diberi peringkat. Peringkat: Kritikal > Tinggi > Sederhana > Rendah, kemudian mengikut impak. Pendua antara laporan sudah digabung. Lajur PRD ialah baris PRD pemilik (`10` = murid, `20` = guru/admin sekolah, `30` = admin pusat).

**Nota pembetulan daripada LIVE-VERIFY (digunakan dalam jadual):**
- Hub SPM V2 ialah 5 kad (Databank, Tracking A, Subjektif, Bijak SPM, Kertas Subjektif); Latih Tubi ialah lorong tetapi bukan kad. `ADMIN-PUSAT.md` menulis "6 lorong".
- Tier Config dan Cabaran Harian V2 (Blade) ialah paparan baca sahaja; Kawalan Reward V2 juga baca sahaja, manakala V1 boleh disunting (termasuk sub-had tebus bulanan). Katalog hadiah: V1 ada Tambah/Edit pada skrin yang sama; V2 mengedit di Filament.
- Tiada skrin admin "Kotak Misteri" atau "Tournament" pada V2/V1; modul #35 ialah Kawalan Reward.
- Kawalan Ciri wujud pada V2 sahaja (19 ciri Pelajar, 10 ciri Guru); Misi Harian Guru ialah ciri V2 sebenar.
- Panel `admin.prestasiplus.cloud` tidak wujud; panel kedua ialah Filament di `/admin-filament`.
- Soalan Berstruktur V2: soalan tanpa skema disembunyikan; rubrik poin A1..An dengan peraturan "mana-mana N".
- Borang Studio V2 tiada medan DSKP (Standard Kandungan/Pembelajaran ialah medan V1); borang V3 sudah melebihi V2.
- Laporan Eksekutif V2 ialah satu skrin yang mengandungi perbandingan sekolah, Headcount TOV → RS dan GPS Perbandingan.

| # | Kelas | Jurang | Portal | Baris matriks / modul | Tingkah laku V2/V1 | V3 sekarang | Berat | Baris PRD pemilik |
|--:|:-:|---|---|---|---|---|:-:|---|
| 1 | a | **Kedai Hadiah Digital: katalog (tambah/edit hadiah) dan Tebusan Queue** (admin proses tebusan) | Admin Pusat → Murid | #31, #38 (Murid 31, 38) | [langsung] V1: "+ Tambah Hadiah", "Edit" setiap baris, "Tebusan Queue", penapis kategori. V2 Blade: katalog + "Tebusan Queue" (katalog diedit di Filament). | `/admin/hadiah` 404; katalog murid kosong dengan teks menunggu; tebusan tidak boleh dipenuhi; BE sedia. | **Kritikal** | 30 P2-07, P2-08; 10 R1-MUR-31, 38 |
| 2 | a | **Tetapan Permainan** (Bilangan Petak Soalan 0-38, senarai permainan, hidup/mati) | Admin Pusat | #21 | [langsung] V2 `/admin/permainan`; V1 sama dengan "Simpan Tetapan". | `/admin/permainan` dan `/admin/games` 404; BE dan klien sedia. | Tinggi | 30 N-05 (P0) |
| 3 | a | **Tracking A**: senarai dan penyunting set (Isi set, tukar, buang, amaran "n soalan lagi diperlukan", penapis subjek) | Admin Pusat → Murid | #13 | [langsung] V2 `/admin/spm/tracking-a` dan `/sunting`; set 40 soalan objektif. | `/admin/spm/tracking-a` 404; hub tiada kad Tracking A. | Tinggi | 30 Q-17 (AC-ADM-Q17.4-.6), Q-01 (P0) |
| 4 | a | **Kawalan Ciri** (togol per peranan) | Admin Pusat | tiada baris matriks (Sistem) | [langsung] V2 sahaja: Pelajar 19, Guru 10 ("Matikan ciri" / "Hidupkan ciri"). Tiada pada V1. | `/admin/feature-toggles` 404; tiada cara matikan Latih Tubi atau Permainan tanpa binaan semula. | Tinggi | 30 N-06, P2-19 |
| 5 | a | **Gamifikasi admin**: Overview, Tier Config, Cabaran, Pelajar (beri syiling), Transaksi, Tetapan | Admin Pusat → Murid | #28, #29, #30, #33, #36 | [langsung] V2 Overview (6 kad, Taburan Tier, Top 10); Tier Config dan Cabaran baca sahaja; V1 ada "Transaksi Terkini". Penyuntingan tier/cabaran daripada V1 [kod/PRD]. Pelajar/Transaksi hanya sidebar. | Semua 404; BE sedia. | Tinggi | 30 P2-01..P2-06 |
| 6 | a | **Kawalan Reward** (ekonomi): bajet tebus/sesi, syiling flat/soalan betul, tahun sesi, mini-games beri syiling, kos sebenar | Admin Pusat | #35, #31 | [langsung] V2 baca sahaja; V1 boleh disunting dan ada sub-had tebus bulanan. | `/admin/reward-control` 404. | Tinggi | 30 P2-09 |
| 7 | a | **Analitik, Laporan, Laporan Eksekutif** (liputan kandungan; penggunaan; satu skrin perbandingan sekolah, Headcount TOV → RS, GPS) | Admin Pusat | #4, #5, #42, #43 (+ #1, #3) | [langsung] V2/V1. | Semua 404. | Tinggi | 30 M-05, M-06, M-08 |
| 8 | a | **Import Pelajar pukal** dari Senarai Pelajar | Admin Sekolah | #51 | [kod] V1/V2 `import-students`. | `/admin-sekolah/pelajar/import` 404; tiada tindakan; AC-CHAIN-8 tidak boleh dijalankan. | Tinggi | 20 R1-AS-51 (6.2b #13) |
| 9 | b | **Remedial tidak menjana pemulihan** daripada subjek ketepatan <60% dan tiada senarai set selesai | Murid | #12 | [kod] V2 `StudentController::remedial`; 4 Nov. | Sejarah 40% (Analisa Item "Perlu Perhatian") tetapi "Tiada topik lemah!". Kad S5-T07 berkelas "Siap (kod)" dengan 3/3 AC CI, bercanggah dengan paparan langsung (perlu siasat). | Tinggi | 10 R1-MUR-12 (FR-12-2, AC-12-7) |
| 10 | c | **Angka bercanggah**: pelajar 20 lawan 17 (Monitoring, Kirkpatrick "T4/T5"); guru 3 lawan 4 | Guru, Admin Sekolah | AS #10, #11; Guru #10, #11 | [kod/PRD] satu definisi (XS-1, XS-3). | AC-XS-1 dan XS-3 gagal; label "T4/T5" keras dilarang PRD. | Tinggi | 20 §5, AC-XS-1 |
| 11 | b | **Jana set terkunci** "Kolam tidak mencukupi" walaupun kolam cukup; kolam dipapar selepas Pratonton sahaja; tiada penapis Tahun/Negeri (G-04) | Admin Pusat | #13 | [langsung] V2: kolam dipapar sebaik subjek dipilih; Tahun 2025-2021, 18 Negeri/badan. | Butang dikunci; terbitan kertas penuh baharu tidak dapat diselesaikan. | Tinggi | 30 Q-13 (AC-ADM-Q13.3) |
| 12 | b | **Import CSV** tiada lajur DSKP/unit/SP/TP/aras dan gagal tanpa sebab (`subject_id`) (G-05) | Admin Pusat | #13, #44 | [kod/PRD] CSV bawa medan DSKP dan kumpulan; senarai ralat per baris. | "0 diimport, 2 gagal"; Sejarah Import hanya kiraan. | Tinggi | 30 Q-11, QE-06; 45 §3.2 |
| 13 | b | **Rangsangan yang diisi hilang senyap** pada Simpan draf jika belum klik "Cipta rangsangan kongsi" (G-01) | Admin Pusat | #9, #13 | [PRD] FR-ADM-QE1/QE2. | Hilang tanpa amaran. | Tinggi | 30 QE-01 (AC-ADM-QE1.6) |
| 14 | b | **Topik tidak ditapis mengikut Bab** (G-02); soalan terbit Bab 7 tidak muncul di Soalan by Chapter murid (G-03, punca belum pasti) | Admin → Murid | #9 | [kod/PRD] | Boleh simpan Bab 7 dengan unit 2.0; tidak muncul. | Tinggi | 30 C-05, QE-03; 10 R1-MUR-9 |
| 15 | b | **Heatmap Topik Lemah kosong** untuk murid yang sudah menjawab 15 soalan | Murid | #14 | [4 Nov] legenda + keadaan kosong. | Belum pasti fungsi (jawapan tidak dipetakan ke topik) atau data; perlu pengesahan murid kedua. | Tinggi (belum disahkan) | 10 R1-MUR-14 |
| 16 | b | **Pengekstrak PDF ialah mock** (`heuristik-1`): pilihan A-D tidak dipecah, 6 isu; OCR sebenar tidak dapat dinilai | Admin Pusat | #13, #44 | [PRD] Tesseract dalaman; mock hanya untuk CI. | Mock pada binaan ini. | Tinggi | 45 §3.3.2; 30 Q-07 (AC-QA-43) |
| 17 | a | **Dashboard Admin Pusat** (kad soalan/Battle/penajaan, Tindakan Pantas, Soalan Terkini, Taburan Status, Muat Turun Data CSV 4 set) | Admin Pusat | #2 | [langsung] V2 dan V1 dashboard sebenar. | `/admin` hanya dialih ke Command Center. | Sederhana | 30 M-01 |
| 18 | a | **Pandangan pusat laporan sekolah**: Headcount #3, Sekolah Bersaing #45, Statistik #46, DSKP Heatmap #47, Laporan Aktiviti #48, Amaran #49, Laporan Bulanan #50 | Admin Pusat | #3, #45-#50 | [kod/PRD] V2 tidak diperhatikan. | 404 | Sederhana | 30 M-07 |
| 19 | a | **Menu admin**: 9 hingga 10 item pendua/aksi masih ada; item sasaran tiada (Audit Rajah, Soalan Berstruktur, Kiriman Guru, Import Pengguna, Latih Tubi, Subjektif) | Admin Pusat | menu | [langsung] V2 ada sub-kumpulan "Bank Lama (Legasi)". | 40 pautan, 8 kumpulan; 46 daripada 106 dibina. | Sederhana | 30 §3; 47 M-01..M-09 |
| 20 | a | **Tab "Kertas Diimport"** ("Semak & Terbit") dalam Import & Semakan | Admin Pusat | #13 | [langsung] 3 tab: Kelompok Item, Kertas Diimport, Kiriman Guru. | Tiada tab. | Sederhana | 30 Q-07 |
| 21 | a | **Cabutan Bertuah admin** (senarai, cipta, tutup, cabut pemenang) | Admin Pusat | #22 | [langsung] Filament sahaja, label Inggeris. | 404 | Sederhana | 30 P2-10 |
| 22 | a | **Kelas Sekolah admin** `/admin/classes` | Admin Pusat | #8, #53 | [kod] V2 urus kelas dalam Sekolah. | 404 | Sederhana | 30 U-08 |
| 23 | a | **Misi Harian Guru** | Guru | #2 | [kod] V2 `TeacherDailyController`; [langsung] Kawalan Ciri menyenaraikan Misi Harian Guru. | `/guru/misi-harian` dan `/cipta` 404; tiada pautan pada Dashboard. | Sederhana | 20 R1-GUR-2b, 6.2b #23 |
| 24 | c | **Dua Papan Pendahulu** tidak konsisten | Murid | #33 | [kod/PRD] satu papan berpenapis. | Menu ke `/gamification/leaderboard` (tiada penapis); `/leaderboard` "1 peserta", "#-". | Sederhana | 10 R1-MUR-33 (AC-33-6) |
| 25 | c | **Amaran Awal dua jumlah** untuk perkara sama | Admin Sekolah | #49 (+ #2) | | `/amaran/sekolah` 0/1/6 lawan Ringkasan Eksekutif 0/2/5; 7 daripada 20 dinilai. | Sederhana | 20 R1-AS-49 (AC-AS-49-8) |
| 26 | c | **Command Center**: Guru "Ketepatan Purata" berlabel "keseluruhan sekolah" untuk nilai kelas, GPS "--"; AS kad "Sekolah Berdaftar/langganan aktif" lawan "Belum Ada Langganan", T4 GPS 0.000 lawan 3.45 | Guru, Admin Sekolah | Guru #1, AS #1, #2 | [PRD] FR-GUR-1-1 "kelas anda". | Label dan kad platform salah. | Sederhana | 20 R1-GUR-1, R1-AS-1, R1-AS-2 |
| 27 | b | **Kedudukan** tiada kad kedudukan sendiri/"sekitar anda" | Murid | #18 | [4 Nov] | Hanya jadual. | Sederhana | 10 R1-MUR-18 |
| 28 | b | **Dashboard murid**: kad "Pakej SPM Aktif" tiada | Murid | #2 | [4 Nov] | Tidak kelihatan. | Sederhana | 10 R1-MUR-2 |
| 29 | b | **DSKP Heatmap**: legenda dipapar berganda | Admin Sekolah | #47 | | "Lemah, Mahir, Mahir, Sederhana, Lemah". | Sederhana | 20 R1-AS-47 |
| 30 | d | **Sisa ujian/demo kelihatan kepada pengguna**: soalan "QA-GAP" di Soalan Terkini murid; kertas "E2E fixture" di Bijak; banner/artikel "Contoh:"; cabutan "Demo"; teks menunggu "Hadiah akan ditambah tidak lama lagi" di Kedai Hadiah | Murid | #2, #13, #20, #22, #31 | | Kelihatan pada akaun murid. | Sederhana | 40 AC-X2-2/3; 10 §4.11 (baris 15) |
| 31 | b | Kod kelas dan Kod QR (tambahan V3; PRD minta buang) | Guru | #8 | tiada pada V2 | Masih ada. | Rendah | 20 6.2b #21 |
| 32 | c | Definisi "{n} entri headcount" (11 lawan 13 murid); label skop (Prestasi kelas 0 soalan lawan Laporan "6/7 pernah latihan"; Sekolah Bersaing 60% lawan 62%; Tingkatan 19 lawan 20; "0/25 dicapai" lawan "Langkah Pertama 1/1") | Guru, AS, Murid | pelbagai | | Perlu satu definisi dan label. | Rendah | 20 §5 XS-6(d) |
| 33 | b | Perkara kecil: label ringkasan Latih Tubi "Kesukaran: Semua Tahap" (patut "Semua"); pautan Rujuk Kawan memakai `localhost:8080` (persekitaran); `GET /api/config/support` 404 (ralat konsol); Kualiti Soalan purata 0.0 sehingga audit dijalankan; Kelas Sekolah AS hanya baca; menu akaun murid memaparkan "Tukar Rakan Belajar" | pelbagai | #16, #36, A3, #54, #53 | | | Rendah | 10 R1-MUR-16, 36, §2.3; 20 R1-AS-53 |
| 34 | a | Modul tanpa skrin admin padanan pada V2/V1: Tournament/Liga, Pencapaian, Kotak Misteri (admin), Jemput Ibu Bapa (admin) | Admin Pusat | #23, #34, #35, #40 | [langsung] tiada (#23, #40); [kod] #34 | 404. Penambahan V3 untuk D100, bukan jurang pariti. | Rendah | 30 P2-11, P2-14, P2-16 |
| 35 | a | Modul ditangguh atau dikeluarkan: Penajaan/Anak Angkat/Permohonan (#15, disembunyi D102), Notifikasi, Audit Log, Pembayaran/Billing/Dunning, Chatbot (#37, AI disembunyi D73) | Admin Pusat | #15, #37, lain-lain | [langsung] wujud pada sidebar V2/V1, kandungan tidak dibuka. | 404; PRD bahagian 6 menangguhkan. | Rendah | 30 §6 |
| 36 | d | Data ujian "QA-GAP" tertinggal dalam pangkalan data admin (soalan 1292-1295, kumpulan rangsangan #3, set #7, kelompok ekstrak 1, kiriman guru 1) | Admin Pusat | - | | Perlu dibersihkan sebelum demo. | Rendah | 30 §5 (U-OP) |

### (e) Item yang hanya disekat oleh data demo nipis (tidak diberi peringkat; fungsi wujud, bukti belum boleh diambil)

Soalan by Chapter (1 bab setiap subjek; 15/20 soalan dilumpuhkan oleh bilangan soalan); Bijak SPM 2 kertas dan swa-markah Subjektif tanpa kertas subjektif; Kertas Subjektif dan Sumber Kertas kosong; kolam seed hanya soalan 1 markah (terbit kertas penuh); Sekolah Bersaing 1 sekolah; Sumbang Soalan statistik 0; Kirkpatrick Tahap 4 "Belum Ada Data"; Laporan Aktiviti trend 0; DSKP Heatmap semua sel "-"; Audio KBAT, Set Soalan Guru, PKSK soalan, Tiket (0), Topik/Peta Belajar (1 topik); Kedai Hadiah dan Kedai Hadiah Digital kosong (juga disebabkan jurang #1); Cabutan dan Tournament "Demo"/kosong; murid T1-T3 tiada akaun demo; Video 3 item.

---

## 4. Konteks repo

Daripada `REPO-STATE.md` (cabang `feature/v3-bijak-r1`, HEAD `b50fa8d41`, dibaca 8 Nov):

| Perkara | Nilai |
|---|---|
| Kad R1 | **10 daripada 118 "Siap (kod)"** (3 daripadanya P0); 93 Separa, 11 Tersekat dalam PR, 4 Belum mula. Tiada kad memenuhi takrif penuh (`[CI+UAT]`). |
| Bukti AC | **197 daripada 1,228 AC dibuktikan CI (16.0%)**; **0 baris UAT**; 0 Fail. Dokumen 48 (permainan): 149 AC, 0 bukti CI. |
| PR digabung | 393 sejak 2 Nov (35 pada 4 Nov, 199 pada 5 Nov, 140 pada 6 Nov, 18 pada 7 Nov); 0 kelulusan rasmi; base tanpa perlindungan cabang. |
| PR terbuka ke base | **88** (45 draf); 60 bercanggah, 21 bersih tetapi CI tidak stabil, 7 bersih. Cadangan triaj: **Ambil 28, Ambil + selesai konflik 35, Buat semula 25, Tutup 0.** Punca konflik terbesar: fail daftar-kongsi (`seed-profile.md` 20 PR, `openapi.json` 18, `r1-canonical-map.json` 15, `r1-ac-ledger.md` 11). |
| UAT | `e34e0a52d` (3 Nov): ketinggalan 502 komit dan 48 migrasi; tiada AC UAT boleh dibuktikan. |
| Ujian tempatan | `contract:check`, `contract-tests`, `be:lint`, `be:lint:migration`, `be:typecheck`, `be:build`, `vite build`, `typecheck`: exit 0. `be:test`: belum selesai (10 fail ujian bergagal, 106 ujian gagal setakat ini; 90 ialah `migration/dump`, kemungkinan artifak Windows). FE unit: 13,458 lulus / 5 gagal (3 artifak CRLF; 2 tamat masa m08 belum muktamad). FE lint: gagal (kehabisan heap, "ratchet FAILED"). |

Kaitan dengan jurang fungsi: kebanyakan jurang Admin Pusat dalam bahagian 3 sudah mempunyai PR terbuka (contohnya #984 dan #758 Hadiah; #736 Tetapan Permainan; #717 dan #718 Tracking A; #907 dan #914 Kawalan Ciri; #735 Import Pelajar; #665 hingga #687 Misi Harian; #751 dan #752 pandangan pusat). Maksudnya jurang itu ialah kerja belum disepadukan, bukan kerja belum dimulakan. Satu percanggahan perlu disiasat: kad S5-T07 (Remedial auto) berkelas "Siap (kod)" tetapi paparan langsung masih menunjukkan jurang.

### Nota data (latar sahaja)

**Peringatan: pemilik produk menyatakan pangkalan data UAT mungkin tidak betul. Bahagian ini BUKAN penilaian dan tidak mempengaruhi mana-mana verdik di atas; modul, ciri dan fungsi sahaja yang dinilai.** Daripada `DATA-GAP.md`, sebagai latar:
- V2 sendiri tidak memetakan soalan ke bab/topik; kerja menanda (tagging) ialah kerja baharu, bukan migrasi.
- Set Bijak/ramalan, kertas, kontrak, rangsangan/gambar dan soalan subjektif sengaja tidak dimigrasi oleh ETL; fungsi yang bergantung padanya tidak boleh dibuktikan pada UAT sehingga kandungan dimuatkan.
- V2 masih aktif (login terakhir 7 Nov), jadi migrasi delta diperlukan sebelum cutover.
- Penunjuk ini tidak dijadikan jurang dalam bahagian 3.

---

## 5. Had penilaian

| Perkara | Keadaan |
|---|---|
| V3-local | Dilihat **langsung** dalam pelayar pada 375/768/1280 px: 46 laluan murid, 26 laluan guru, 19 laluan admin sekolah, 56 laluan admin pusat, aliran F1-F9. Data demo kecil, jadi kekosongan dilabel data atau fungsi. |
| V2/V1 skrin **admin pusat** | Dilihat **langsung** (hanya baca, satu lorong, 29 halaman V2 dan 12 V1, tiada peristiwa Cloudflare atau kebenaran). Skrin selepas tindakan (Hantar semakan, Terbit, Arkib), halaman Gamifikasi Pelajar/Transaksi/Gamifikasi Guru, Penajaan, Anak Angkat, Notifikasi, Audit Log, Chatbot, Billing dan skrin edit Filament tidak dibuka. |
| V2/V1 paparan **murid, guru, admin sekolah** | **Tidak dilihat langsung.** Rujukan ialah kod V2 (`D:\Dev Projects\prestasiplus-reference\backend`), PRD, nota 4 Nov dan dokumen penemuan V1. "Log masuk sebagai" V2 (`ImpersonateController`) tidak digunakan kerana ia menulis `audit_logs` dan melog masuk sebagai pengguna sebenar. Perubahan V2 sejak 4 Nov tidak diperiksa. |
| Tindakan menulis | Tidak dijalankan pada V3-local: cipta kelas/pelajar/guru, import, simpan profil/tetapan, Remedial, Evaluate, Hantar Kertas, tebus hadiah, penukaran token, beli tiket cabutan, simpan mood, Tiket Baru, Tambah Post, Log Keluar guru. |
| Tidak diuji | Murid T1-T3 (tiada akaun demo); akaun `guruadmin`; mod gelap dan 320 px; eksport CSV/PDF Monitoring dan Kirkpatrick; Analisis Risiko Mengikut Subjek (teks sahaja); butiran pelajar Guru; punca satu ralat konsol pada setiap halaman guru; pengekstrakan OCR sebenar; muat naik PDF oleh guru; punca G-03. |
| Pelarasan LIVE-VERIFY | Satu halaman NPS "Maklum Balas Anda Penting" pada admin V2 ditutup dengan "Nanti dulu" (mungkin merekod penolakan pada sisi V2). Lain-lain baca sahaja. |
| Fail matriks | `Matriks-Akses-Peranan .xlsx` tiada lajur Admin Pusat; baris #1-#54 dianggap "modul yang mesti boleh diurus Admin Pusat" (seperti 4 Nov). Penanda 1.0 mengikut garis dasar. |
| Pertindihan laporan | `GURU-ADMIN-SEKOLAH.md` dan `ADMIN-PUSAT.md` dibaca daripada kod; bila bercanggah dengan `LIVE-VERIFY.md`, yang terakhir digunakan (lihat nota pembetulan bahagian 3). |

---

## 6. Susunan kerja disyorkan (fungsi sahaja)

Rujukan kepada nombor jurang bahagian 3. Kad/PR berkaitan daripada `REPO-STATE.md` ditulis sebagai petunjuk, bukan arahan gabung.

| Gelombang | Fokus | Jurang | Kad / PR berkaitan | Hasil yang dibuktikan |
|---|---|---|---|---|
| **0. Kebersihan (cepat)** | Buang sisa ujian dan betulkan label kecil sebelum sebarang demo | #30, #36, #33, #31 | S5-T05, S5-T04, S7-T02 (#936) | Tiada "QA-GAP", "E2E fixture", "Contoh:", "tidak lama lagi" pada akaun pengguna; label betul. |
| **1. Jalur soalan P0 (Bijak SPM)** | Pastikan admin boleh memasukkan dan menerbitkan kandungan hujung ke hujung | #13, #14, #12, #11, #16, #3, #20, #19 | S2-T01 (#685), S1-T05 (#973), S3-T02, S1-T03/S1-T04, S3-T05 (#717, #718), S1-T10 (#859), S0-T07 (#904, #779) | Cipta soalan dengan rangsangan tanpa kehilangan; CSV dengan lajur DSKP; Jana set boleh digunakan; Tracking A boleh disunting; tab Kertas Diimport; menu tanpa pendua; pengekstrak sebenar pada UAT. |
| **2. Ekonomi pelajar boleh diurus admin** | Admin boleh memberi dan memproses apa yang murid nampak | #1, #4, #6, #2, #5, #21 | S7-T11 (#984, #758), S7-T05 (#982), S0-T10/T11 (#907, #914), S7-T03 (#736), S7-T04 (#737, #1004, #1022, #1025), S7-T07 (#864, #903, #953, #958, #972) | Tebusan hujung ke hujung (katalog, tebus, hantar kod, batal); Kawalan Ciri hidup/mati modul; Kawalan Reward; Tetapan Permainan; Gamifikasi; Cabutan. Urutan: #4 dan #1 dahulu (suis go-live dan tebusan). |
| **3. Fungsi murid, guru, admin sekolah** | Tutup baki ⚠️ pada tiga portal pengguna | #9, #15, #8, #23, #10, #24, #25, #26, #27, #28, #29, #32 | S5-T07 (siasat), S10-T05 (#851), S6-T09 (#735), S6-T07 (#665-#687), S6-T03 (#1061), S7-T06 (#794, #1021), S6-T04, S5-T04 | Remedial menjana daripada subjek <60%; Heatmap disahkan; Import Pelajar pukal; Misi Harian Guru; satu definisi pelajar/guru/amaran; satu Papan Pendahulu; kad Kedudukan dan Pakej SPM Aktif. |
| **4. Pemantauan dan laporan pusat** | Admin Pusat nampak platform sebagaimana V2/V1 | #17, #7, #18, #22 | S6-T11 (#751, #752), S6-T13 | Dashboard (dengan keputusan CSV pemilik produk), Analitik, Laporan, Laporan Eksekutif, pandangan pusat sekolah, Kelas Sekolah. |
| **5. Baki dan penangguhan** | Item berat Rendah dan modul ditangguh | #34, #35, #31 (jika tidak dibuang dalam gelombang 0) | S6-T15 (#748) | Keputusan pemilik produk tentang penambahan V3 dan modul ditangguh. |

Prasyarat bukan fungsi untuk semua gelombang (rujukan `REPO-STATE.md`, bukan jurang fungsi): selesaikan baris gilir konflik fail daftar-kongsi, kemas kini papan status, dan deploy base ke UAT supaya baris AC UAT boleh diisi.

---

## Lampiran A. Cadangan kemaskini PRD: diterapkan, diselaraskan atau digugurkan

Sumber: `MURID.md` §6 (M), `GURU-ADMIN-SEKOLAH.md` §6 (G), `ADMIN-PUSAT.md` §6 (A), `LIVE-VERIFY.md` §4 (L). Keputusan: **Diterapkan** = dimasukkan seperti dicadangkan; **Diselaraskan** = dimasukkan selepas dibetulkan oleh LIVE-VERIFY atau mengikut peraturan PRD sedia ada; **Digugurkan** = tiada perubahan teks, dengan sebab. Entri log perubahan ada dalam `docs/prd/r1/00-index.md` (bahagian "Change log"; fail PRD tiada log sendiri).

| ID | Sumber cadangan | Fail PRD / ID | Keputusan | Sebab |
|---|---|---|---|---|
| M-1 | MURID §6: menu akaun, Tiket Bantuan | 10 §2.3 | Diselaraskan | V3 memaparkan Tiket Bantuan dan A4 ialah baris matriks bertanda (D100). LIVE-VERIFY: pada V2 ia ciri boleh dimatikan dalam Kawalan Ciri, bukan tersembunyi tetap. Teks lama dipotong dengan sebab; "Tukar Rakan Belajar" kekal OQ-MUR-3. |
| M-2 | MURID §6: jadual ringkasan | 10 §5 (R1-MUR-3, 4, 6, 54, 14; juga 12, 33) | Diterapkan | Lajur status diberi nota 8 Nov; baris 14 ditanda "belum disahkan"; jumlah AC 325 ke 327. |
| M-3 | MURID §6: Remedial | 10 R1-MUR-12 | Diselaraskan | PRD sudah ada peraturan 60% dan senarai set selesai (FR-12-2, AC-12-1..6). Ditambah AC-MUR-12-7 (kad mesti sepadan Analisa Item) dan nota status "masih terbuka". |
| M-4 | MURID §6: Papan Pendahulu | 10 R1-MUR-33 | Diselaraskan | PRD sudah menetapkan satu papan (FR-33-5, D113). Ditambah AC-MUR-33-6 (menu ke `/leaderboard`, pengalihan, kedudukan sendiri) dan status. |
| M-5 | MURID §6: senarai "akan datang" | 10 §4.11 | Diterapkan | Baris 15 ditambah dengan pembetulan salinan (salinan kosong V2); baris 14 ditandakan ditutup. |
| G-1 | GURU-AS §6: daftar 6.2b baris 1, 2, 4, 7, 8, 9, 11, 12, 14, 15, 16 | 20 §6.2b | Diselaraskan | Ditandakan ditutup dengan tarikh dan commit. Baris 9 (Kirkpatrick) hanya ditutup untuk laluan/penapis; label "T4/T5" kekal di bawah AC-XS-1. Baris 16 hanya ditutup untuk AS-46 dan AS-50 (legenda berganda AS-47 kekal). Baris 6 ditandakan separa ditutup. |
| G-2 | GURU-AS §6: baris 13 | 20 §6.2b #13 | Diterapkan | Kekal terbuka; disahkan semula 404. |
| G-3 | GURU-AS §6: baris 21 | 20 §6.2b #21 | Digugurkan | Tiada perubahan diperlukan (kekal terbuka seperti sedia ada). |
| G-4 | GURU-AS §6: R1-GUR-2b | 20 R1-GUR-2b, 6.2b baris 23 baharu | Diterapkan | Misi Harian 404; LIVE-VERIFY menyokong (ciri V2 sebenar dalam Kawalan Ciri). |
| G-5 | GURU-AS §6: AC-XS-1 | 20 §5 AC-XS-1 | Diterapkan | Nota status 8 Nov: XS-4 dan XS-5 ditutup; XS-1 (20/17) dan XS-3 (3/4) masih; teks keperluan tidak diubah. |
| G-6 | GURU-AS §6: R1-AS-49 | 20 R1-AS-49 (AC-AS-49-8), §6.1 | Diterapkan | AC jumlah Amaran Awal sama merentas skrin; jumlah AC AS 146 ke 147. |
| G-7 | GURU-AS §6: §1.3 impersonate | 20 §1.3 | Diselaraskan | Dimasukkan sebagai nota bukti sahaja (bukan keperluan, V3 tidak membina impersonate). LIVE-VERIFY mengesahkan ia tidak digunakan kerana menulis `audit_logs`. |
| G-8 | GURU-AS §6: FR-GUR-1-2 label | 20 FR-GUR-1-2 | Digugurkan | PRD sudah menyatakan "kelas anda" (FR-GUR-1-1, FR-GUR-1-2); cacat ada pada kod V3, dijejak sebagai jurang #26. |
| A-1 | ADMIN-PUSAT §6: nota D115 §3.3 | 30 §3.3 | Diselaraskan | Laluan kini wujud dikemas kini; mengikut LIVE-VERIFY, hub V2 = 5 kad dan Kawalan Ciri V2 sahaja. |
| A-2 | ADMIN-PUSAT §6: Q-17 "kekal 404; hub 5 kad" | 30 Q-17, Q-01 | Diselaraskan | Status 404 disahkan semula; "6 lorong" V2 dibetulkan kepada 5 kad Blade (varian Panel 4 Nov = 6). PRD kekal 6 kad sebagai soalan pemilik produk (§8.5 butir 1). |
| A-3 | ADMIN-PUSAT §6: Q-16 "1 Disahkan" | 30 Q-16 | Diselaraskan | Hanya status fungsi (Disahkan boleh dipilih dan mengesahkan); angka 1 kontrak ialah data, bukan keperluan. |
| A-4 | ADMIN-PUSAT §6: Q-03 satu baris gilir | 30 Q-03 | Diterapkan | Satu baris gilir disahkan; item menu "Baris Gilir Semakan" masih perlu dibuang. |
| A-5 | ADMIN-PUSAT §6: 45 §3.3.2 butir 7 | 45 §3.3.2 | Diterapkan | PDF kini tamat; pengekstrak mock dibenarkan hanya untuk CI (D112(2)); tab Kertas Diimport masih tiada. |
| A-6 | ADMIN-PUSAT §6: 47 menu | 47 (perenggan status) | Diterapkan | Pendua menu belum dilaksana (9 hingga 10); satu baris gilir sudah. Ditambah preseden V2 (Bank Lama). |
| A-7 | ADMIN-PUSAT §6: AC rangsangan G-01 | 30 QE-01 (AC-ADM-QE1.6) | Diselaraskan | Diletakkan dalam 30 (bukan 45) kerana 45 menetapkan satu AC bagi setiap FR (AC-QA-01..51); AC baharu tanpa FR baharu mengelak memecahkan semakan jejak. |
| L-1 | LIVE-VERIFY §4.1: Kawalan Ciri, "jangan tulis 6 lorong" | 30 §3.3, Q-01 | Diterapkan | Digabungkan dengan A-1/A-2. |
| L-2 | LIVE-VERIFY §4.2: Q-17 AC fungsi | 30 Q-17 (AC-ADM-Q17.4, Q17.5, Q17.6) | Diterapkan | Senarai (penapis Subjek, Cari, amaran), penyunting (counter, Isi set, tukar, buang, "n soalan lagi diperlukan"), set lengkap. Sasaran 40 ditulis sebagai cerapan V2, bukan malar. |
| L-3 | LIVE-VERIFY §4.3: AC Semak kertas | 30 Q-15 (AC-ADM-Q15.5) | Diterapkan | Terbitkan dilumpuhkan sehingga masalah skema diselesaikan; chip "DRAF — belum diakses pelajar". |
| L-4 | LIVE-VERIFY §4.4: Tier/Cabaran baca sahaja; CRUD hadiah wajib | 30 §4.H (nota langsung P2-02, P2-03, P2-07) | Diselaraskan | PRD sudah merekodkan V2 baca sahaja dan CRUD hadiah + Tebusan Queue wajib (P2-07, P2-08). Keperluan penyuntingan tier/cabaran (daripada V1) dikekalkan dan dibawa sebagai soalan (§8.5 butir 4). |
| L-5 | LIVE-VERIFY §4.5: "Kotak Misteri" ialah Kawalan Reward; tiada skrin Kotak Misteri/Tournament | 30 §4.H (P2-09, P2-11, P2-14) | Diselaraskan | P2-09 sudah Kawalan Reward. Ditanda P2-11 dan P2-14 sebagai penambahan V3 (D100); sub-had bulanan V1 kekal dikecualikan (D113 N-8). Soalan §8.5 butir 5 dan 6. |
| L-6 | LIVE-VERIFY §4.6: eksport CSV dashboard | 30 M-01 | Diselaraskan | V2 dan V1 memang ada. PRD sedia ada menangguhkan CSV (keputusan pemilik produk); tidak diubah, dibawa sebagai soalan (§8.5 butir 2). |
| L-7 | LIVE-VERIFY §4.7: Laporan Eksekutif satu skrin | 30 M-08 (nota FR-ADM-M08.1, AC-ADM-M08.2) | Diterapkan | Perbandingan Sekolah, Headcount TOV → RS, GPS Perbandingan sebagai seksyen satu halaman. |
| L-8 | LIVE-VERIFY §4.8: Soalan Berstruktur | 30 Q-23 (nota FR-ADM-Q23.3, AC-ADM-Q23.3, Q23.4) | Diselaraskan | Disembunyikan tanpa skema: sudah dalam PRD, ditambah AC. "Mana-mana N" diwakili oleh kumpulan skema "Mana-mana N daripada M" (editor K/N/P, FR-ADM-QE3.9); keperluan editor K/N/P tidak diganti. |
| L-9 | LIVE-VERIFY §4.9: medan DSKP ialah V1, bukan Studio V2 | 30 QE-03 | Diterapkan | Nota dimasukkan; V3 sudah melebihi V2; tiada kawalan lima radio V1. Pembetulan sampingan: "13" kepada 14 mod jawapan V2. |
| L-10 | LIVE-VERIFY §4.10: AC Import Pengguna | 30 U-06 (AC-ADM-U06.2) | Diselaraskan | Akaun baharu sahaja, `nama,email`, akaun menunggu kelulusan dengan "Semak & luluskan". Senarai peranan bercanggah (PRD: Guru/Admin Sekolah/Pegawai PPD; LIVE: Guru/Ibu Bapa/Admin), PRD kekal dan soalan dibawa (§8.5 butir 3). |
| L-11 | LIVE-VERIFY §4.11: panel `admin.prestasiplus.cloud` tidak wujud | 30 pengepala; 40 X1 baris 1 | Diterapkan | Rujukan diganti dengan panel Filament `/admin-filament` (30 baris 17, 18, 40; 40 X1). |
| L-12 | LIVE-VERIFY §4.12: label V2 tepat | 30 §4.H (baris pengesahan label) | Diselaraskan | Label sudah ada dalam PRD; hanya baris pengesahan ditambah. |

### Bilangan mengikut fail PRD

| Fail | Cadangan | Diterapkan | Diselaraskan | Digugurkan |
|---|:-:|:-:|:-:|:-:|
| `10-murid.md` | 5 | 2 | 3 | 0 |
| `20-guru-admin-sekolah.md` | 8 | 4 | 2 | 2 |
| `30-admin-pusat.md` | 17 | 7 | 10 | 0 |
| `40-cross-cutting.md` | 1 (L-11, juga dikira dalam 30) | 1 | 0 | 0 |
| `45-question-authoring-flow.md` | 1 | 1 | 0 | 0 |
| `47-v3-duplicates-register.md` | 1 | 1 | 0 | 0 |
| **Jumlah cadangan unik** | **32** | **15** | **15** | **2** |

Catatan: 40 diubah oleh L-11 yang sama dengan satu cadangan di 30, jadi tidak ditambah dalam jumlah unik. `00-index.md` hanya menerima entri log dan satu ayat soalan terbuka.

### Lampiran B. Suntingan PRD tambahan (bukan cadangan rasmi, daripada bukti LIVE-VERIFY §3)

| Fail / ID | Suntingan | Sebab |
|---|---|---|
| 30 Q-13 (AC-ADM-Q13.3) | Kolam dipapar sebaik subjek dipilih; butang tidak dikunci ketika kolam cukup | G-04 + baris Set Builder LIVE-VERIFY |
| 30 M-05 | Nota seksyen sebenar Analitik (termasuk "Taburan Kesukaran Mengikut Subjek") dan Laporan | LIVE-VERIFY baris #4, #42, #43 |
| 30 N-05, P2-01, P2-10, P2-15, baris 40 | Nota sahih langsung (Overview V2 tiada "Transaksi Terkini", V1 ada; Cabutan hanya Filament; Jemput Ibu Bapa tiada menu admin) | LIVE-VERIFY §3 |
| 30 N-06 | Pengesahan langsung 19 + 10 baris dan sifat ciri boleh togol | LIVE-VERIFY §3 |
| 30 §8.1, §8.5 | Jumlah AC 252 ke 262; bahagian baharu 6 soalan untuk pemilik produk | Konsistensi pengiraan; soalan tidak diputuskan |
| 00-index | "Change log" baharu + ayat soalan terbuka | Tiada log dalam fail PRD |

Nota teknikal: semakan `node scripts/r1-trace-check.mjs` tidak dijalankan (tiada shell dalam sesi ini). AC baharu bergantung pada FR sedia ada dan tiada FR baharu ditambah, tetapi larian itu perlu dibuat sebelum gabung.

---

## Lampiran C. Soalan dan percanggahan yang belum diselesaikan (untuk pemilik produk)

| # | Perkara | Sumber yang bercanggah | Lalai digunakan |
|---|---|---|---|
| 1 | **Peraturan 70% buka bab seterusnya** (Soalan by Chapter). `MURID.md` menyenaraikannya sebagai jurang; `00-index` PRD menyatakan keputusan "tiada kunci 70%" (ditutup). | `MURID.md` lawan `00-index.md` | Mengikut PRD (tiada kunci); tidak dikira sebagai jurang dalam bahagian 3. |
| 2 | Hub SPM: V2 Blade 5 kad (tiada Latih Tubi), PRD 6 kad. | LIVE-VERIFY lawan 30 Q-01 | PRD kekal 6. |
| 3 | Muat Turun Data CSV dashboard (V2/V1 ada) lawan penangguhan PRD. | LIVE-VERIFY lawan 30 M-01 | Ditangguh. |
| 4 | Senarai peranan Import Pengguna (Guru/Admin Sekolah/PPD lawan Guru/Ibu Bapa/Admin). | 30 U-06 lawan LIVE-VERIFY | Guru/Admin Sekolah/PPD. |
| 5 | Tier Config dan Cabaran: baca sahaja (V2) lawan boleh disunting (V1 dan PRD). | LIVE-VERIFY lawan 30 P2-02/03 | Penyuntingan dikekalkan. |
| 6 | Sub-had tebus bulanan (hanya V1) lawan satu bajet sesi (PRD D113 N-8). | LIVE-VERIFY lawan 30 P2-09 | Tiada sub-had. |
| 7 | Kotak Misteri, Tournament/Liga, Jemput Ibu Bapa admin: tiada pada V2/V1, tetapi diperlukan PRD (D100). | LIVE-VERIFY lawan 30 P2-11, 14, 16 | Dikekalkan sebagai penambahan V3. |
| 8 | Tiket Bantuan dalam menu akaun murid: baris A4 ditanda "Selepas 1.0" tetapi sudah dipaparkan. | 10 §2.3 lawan [V3] | Dipaparkan; dikemas kini dalam PRD. |
| 9 | Kad S5-T07 (Remedial) "Siap (kod)" dengan 3/3 AC CI, tetapi paparan langsung menunjukkan jurang. | `REPO-STATE.md` lawan `MURID.md` | Jurang dikekalkan sehingga disiasat oleh pasukan. |
| 10 | Kad "Transaksi Terkini" pada Overview V2: dicerap 4 Nov, tiada pada 8 Nov. | PRD P2-01 lawan LIVE-VERIFY | Kad dikekalkan dalam keperluan; hanya nota dibuat. |
