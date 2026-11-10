# Analisis Jurang MURID: V3-local lawan V2 dan V1 (2026-11-08)

Kaedah dan sumber:
- V3-local (http://localhost:5194, HEAD b50fa8d41): dibuka LIVE dalam Playwright lane 1 (headed). Akaun: `pelajarmaju` (T5, ada data), `murid4` (T4, ada data kelas/Headcount/Bijak). Semua 46 laluan Murid disapu pada 1280/768/375 (teks, 403/404, limpahan mendatar, skrin tangkap). Aliran penuh diuji: Latih Tubi (5 soalan hingga keputusan), Soalan by Chapter (5 soalan hingga keputusan), Bijak SPM (mula, 6 soalan, Hantar, keputusan di 375), Lapor Soalan (hantar, kemudian muncul di Laporan Soalan Saya), Headcount (butiran), Soalan Berstruktur (halaman jawab), Log Keluar.
- V2 (prestasiplus.cloud): TIADA akses pelayar langsung pada sesi ini (arahan Ketua: kod dan pelayan dahulu, had Cloudflare). Rujukan V2 = kod `D:\Dev Projects\prestasiplus-reference\backend` (mis. `StudentController::remedial`, `ImpersonateController`) + pemerhatian 4 Nov dalam `docs/qa/gap-analysis-2026-11-04/MURID.md` (ditanda "4 Nov"). Tiada pelayan produksi disoal.
- V2 pandangan murid melalui "log masuk sebagai": `ImpersonateController` wujud (admin pusat boleh menyamar murid aktif), tetapi ia menulis `audit_logs` dan melog masuk sebagai murid sebenar (data peribadi, kemungkinan kemas kini streak/last-seen). Ini bukan pertukaran paparan baca-sahaja, jadi TIDAK dijalankan.
- V1 (prestasiplus.my): tiada akses pelayar pada sesi ini; lajur V1 = tanda matriks + dokumen discovery (seperti baseline 4 Nov).
- Data V3 ialah seed demo kecil. Setiap kekosongan dilabel: DATA (seed) atau FUNGSI.
- Bukti: `D:\Dev Projects\prestasiplus-v3\.evidence\gap-2026-11-08\murid\` (git-ignored), fail `v3-<laluan>-1280.png` dan `v3-<laluan>-375.png` (mis. `v3-dashboard-1280.png`). Kemudian fail khas disebut pada jadual.
- Privasi: tiada nama sebenar; akaun demo disebut sebagai peranan/ID.

Legenda: ✅ setara/lebih baik dari V2; ⚠️ separa; ❌ tiada/rosak. Perubahan sejak 4 Nov: ditutup / masih / baru rosak.

## 1. Ringkasan (scoreboard)

| Skop | Baris | 8 Nov ✅ / ⚠️ / ❌ | 4 Nov ✅ / ⚠️ / ❌ |
|---|:-:|:-:|:-:|
| Murid 1.0 | 18 | 13 / 5 / 0 | 7 / 7 / 4 |
| Baris selebihnya (incl. A4; 15 dan 37 disembunyi mengikut D102) | 25 | 19 / 6 / 0 | 17 / 6 / 2 |
| Semua | 43 | 32 / 11 / 0 | 24 / 13 / 6 |

Perubahan utama sejak 4 Nov (semua disahkan live di V3-local):
- Ditutup: Headcount (403 kini halaman sebenar + butiran), Prestasi (kini Prestasi 360 individu; `/prestasi/sekolah` kini 403), Analisa Item (halaman peribadi), Laporan Soalan Saya (menu + hantar + jejak status), Profil Saya (profil awam, bio/cita-cita, statistik, lencana, kalendar kombo, sesi terkini), Tetapan (kad akaun), Dashboard (Kombo, check-in mood, Cabaran Kilat, Soalan Terkini), Kedudukan (senarai berisi untuk T4), Rujuk Kawan (100 syiling, sama V2), Timeline (suapan automatik), Bijak SPM di 375 (butang Hantar kelihatan, tiada limpahan).
- Masih: Remedial tidak menjana daripada subjek lemah; Bijak/Chapter nipis (DATA); peraturan 70% tidak dinyatakan; katalog hadiah kosong (DATA); tiada kad kedudukan sendiri.
- Baru rosak: tiada rosak fungsi baharu. Baru ditemui: serpihan data ujian (QA/E2E/"Contoh:") kelihatan kepada murid; label ringkasan Latih Tubi salah.
- Responsif: 46 laluan x 3 lebar, limpahan mendatar 0 px (Panduan: -15 px, tiada skrol). Tiada lencongan/403 pada 43 item menu.

## 2. Baris Murid 1.0

| # | Modul | V1 | V2 (4 Nov / kod) | V3-local 8 Nov | Verdict | Perubahan | Apa yang kurang | Bukti |
|---|---|---|---|---|---|---|---|---|
| A1 | Profil Saya | Profil (M01) | Kad profil, profil awam, statistik, bio/cita-cita, kombo, lencana, kalendar, sesi terkini | Semua blok ada (Profil Awam + Salin, 6 statistik, Bio 0/1000, Cita-Cita, Kombo, 25 lencana, Kalendar Kombo 30 hari, Sesi Terkini) | ✅ | ditutup | Tiada | v3-profile-1280/375 |
| A2 | Tetapan Peribadi | Tetapan akaun | Kad akaun baca-sahaja | Kad akaun (e-mel, telefon, sekolah, peranan, status) + Mod Rohani | ✅ | ditutup | Tiada tukar kata laluan (V2 juga baca-sahaja) | v3-tetapan-1280 |
| A3 | Panduan | Panduan | 5 peranan, langkah daftar | Sama | ✅ | masih | Tiada | v3-panduan-1280 |
| A5 | Log Keluar | Ada | Ikon keluar | Menu akaun > Log Keluar > `/login` (diuji) | ✅ | masih | Menu akaun juga ada "Tiket Bantuan" dan "Tukar Rakan Belajar" (PRD 2.3 kata tersembunyi) | v3-dashboard-1280 |
| 2 | Dashboard | M05-T3 | Salam, Pakej SPM Aktif, Kombo, 5 kiraan, Misi Harian, mood, Cabaran Kilat, Artikel, Subjek, Soalan Terkini | Salam, streak/koin/mata, Kombo, 5 kiraan, Misi Harian 0/10, lencana, Cabaran Kilat, mood (4 butang), 5 pintasan, Artikel, Subjek (31), Statistik, Soalan Terkini | ⚠️ | separa ditutup | Kad "Pakej SPM Aktif" tidak dilihat. Soalan Terkini memaparkan soalan ujian "QA-GAP". Banner "Contoh: ..." (D100, DATA). Butang mood tidak diuji simpan | v3-dashboard-1280/375 |
| 3 | Headcount | Ditolak murid (V1) | Halaman + keadaan kosong | `/headcount`: kad subjek/kelas, "Lihat Data Saya" > butiran TOV/OTR/ETR/Jurang/Checkpoint. Keadaan kosong "Belum ada Headcount" untuk murid tanpa kelas | ✅ | ditutup | Tiada | v3-headcount-1280, v3-headcount-detail-1280 |
| 4 | Prestasi | Dashboard sekolah (admin) | Prestasi 360 individu | "Prestasi 360 - Dashboard Individu": ketepatan, kombo, sesi, masa, Headcount-Prestasi SPM, Trend 12 minggu. `/prestasi/sekolah` kini 403 | ✅ | ditutup (kebocoran data dibaiki) | Peta Aktiviti 90 hari, Cadangan Latihan, Penguasaan Subjek tidak dilihat dalam 520 aksara pertama (tidak disahkan) | v3-prestasi-1280/375, v3-prestasi_sekolah-1280 |
| 5 | Analitik Adaptif | M08-S7 | 14 tab subjek, SP dikuasai | Topik Perlu Perhatian, SP Standard 0/48, trend 30 hari, unjuran gred | ✅ | masih | Tiada (kekosongan = DATA) | v3-analitik_pelajar-1280 |
| 6 | Analisa Item | Guru sahaja | Halaman peribadi | Kad (Soalan Dijawab, Perlu Pemulihan/Pengukuhan, Penguasaan), subjek perlu perhatian, penapis, Isyarat Awal, "Ulang Kaji Subjek Ini". `/analisa-item/kelas` 403 | ✅ | ditutup | Tiada | v3-analisa_item-1280/375 |
| 7 | Video | M09 | Tab kategori | Tab + 3 video seed | ✅ | masih | Tiada | v3-video-1280 |
| 8 | Kelas Saya | M10 | Keadaan kosong | murid4: 2 kelas + guru; maju: "Anda belum dimasukkan ke dalam kelas" | ✅ | masih | Kotak kod kelas (V3 tambahan 4 Nov) tidak kelihatan lagi (tiada dalam V2, bukan jurang) | v3-kelas_saya-1280 |
| 9 | Soalan by Chapter | `/practice/chapter` | 14 subjek, 26-97 bab, peraturan 70% | Pilih Tahap, kad subjek (1 bab, 10 soalan), pilih 5/10 soalan, kuiz penuh hingga keputusan (Cuba Lagi, Senarai Bab) berjaya | ⚠️ | separa ditutup (aliran hidup) | Peraturan 70% tidak dinyatakan; 1 bab/subjek (DATA); 15/20 soalan lumpuh kerana 10 soalan sahaja (DATA); T1-T3 tidak boleh diuji (tiada akaun) | v3-practice_chapter-1280/375, v3-chapter-subject-1280 |
| 12 | Remedial | M05 | Kad pemulihan dijana dari subjek ketepatan <60% (kod `StudentController::remedial`) + set selesai | maju: Sejarah 40% (Analisa Item "Perlu Perhatian Sekarang") tetapi Remedial "Tiada topik lemah!" | ⚠️ | masih | Tidak menjana pemulihan dari subjek lemah; tiada senarai set selesai (FUNGSI) | v3-remedial_saya-1280, v3-analisa_item-1280 |
| 13 | SPM (Bijak SPM, Databank, Tracking A, Subjektif) | Hub M06 | Hub 408,197 soalan, 69 set Bijak | `/spm` hub (495 soalan, 25 subjek, Tracking A 370). Bijak: Mula > 6 soalan > Hantar (pengesahan "belum menjawab 6") > keputusan (markah bahagian, topik semak, Cuba Lagi). Di 375: Hantar kelihatan pada soalan akhir, tiada limpahan | ⚠️ | separa ditutup (kecacatan 375 ditutup) | 2 kertas sahaja (DATA); kertas "E2E fixture" kelihatan kepada murid; swa-markah Subjektif tidak dapat diuji (tiada kertas subjektif dalam demo); widget/stimulus pelbagai tidak diuji | v3-spm-1280, v3-spm_bijak-1280, v3-bijak-attempt-375, v3-bijak-lastq-375, v3-bijak-result-375 |
| 14 | Heatmap Topik Lemah | R10-S1 | Legenda + kosong | maju: "Belum ada data heatmap lagi" walau ada 15 jawapan; murid4 tidak diperiksa | ⚠️ | masih/tidak pasti | Mungkin FUNGSI (jawapan tidak dipetakan ke topik) atau DATA; perlu disahkan dengan murid4 | v3-buku_nota_heatmap-1280 |
| 16 | Latih Tubi | M05 | `/practice` dialih (OFF) | Subjek > tahap > kesukaran > bilangan > Mula Kuiz > Semak Jawapan ("Betul") > Soalan Seterusnya > Lihat Keputusan (skor, ganjaran 10 mata, 1 koin, streak, Semakan Semula) berjaya | ✅ | masih | Label ringkasan "Kesukaran: Semua Tahap" salah (patut "Semua"); tiada penjelasan jawapan pada seed ini | v3-practice-1280, v3-practice-result-375 |
| 21 | Permainan | M16 | `/permainan` OFF; `/battle` | Zona Permainan: 14 permainan (Papan Bijak, Battle, Perang Fakta, Benteng Ilmu, Roda Nasib, Jutawan, dll), "Tiada bilik terbuka" | ✅ | masih | Tiada (V3 melebihi V2). Permainan individu tidak dimainkan | v3-permainan-1280/375 |
| 54 | Laporan Soalan | M04-S13 | Halaman peribadi | Menu ada. Dalam kuiz "Lapor Soalan" > 7 sebab + komen > "Laporan berjaya dihantar" > Laporan Soalan Saya: 1 Jumlah, 1 Menunggu, baris dengan sebab/komen/tarikh | ✅ | ditutup | Tiada | v3-laporan_soalan-1280, v3-lapor-dialog-1280 |

## 3. Baris Murid selebihnya

| # | Modul | V1 | V2 (4 Nov) | V3-local 8 Nov | Verdict | Perubahan | Apa yang kurang | Bukti |
|---|---|---|---|---|---|---|---|---|
| A4 | Tiket Bantuan | M22 | Tapis status, Tiket Baru | 6 tapisan, "Tiket Baru", keadaan kosong "Buat Tiket Pertama". `/pusat-tuisyen/tiket/baru` = 404 (borang mungkin dialog, tidak diuji) | ✅ | masih | Borang Tiket Baru tidak diuji | v3-pusat_tuisyen_tiket-1280 |
| 15 | Mohon Keluarga Angkat | M21-S6 | Borang | 404 (disembunyi D102) | ✅ (mengikut keputusan) | masih | Tiada | v3-mohon_keluarga_angkat-1280 |
| 17 | Soalan Berstruktur | M04/M05 | Penapis + senarai | Penapis Subjek/KBAT/Cari, 3 set, "Mula" > halaman jawab (bahagian, markah, Hantar & Semak, Lapor) | ✅ | masih | Hantar & Semak tidak diuji | v3-latihan_berstruktur-1280, v3-berstruktur-start-1280 |
| 18 | Kedudukan | `/ranking` | Kad kedudukan sendiri + sekitar | murid4: jadual 7 murid (tahap, betul, tepat), penapis Skop/Subjek/Tingkatan, "Menunjukkan 7 dari 7" | ⚠️ | separa ditutup (4 Nov kosong) | Tiada kad kedudukan sendiri/"Sekitar anda" di atas | v3-ranking-1280 |
| 19 | PKSK | M07 | Terkunci tanpa pakej | murid4: "Anda belum mempunyai akses PKSK PRO" + format A/B/C; maju: terbuka | ✅ | masih | "0 Jumlah soalan" (DATA) | v3-pksk-1280 |
| 20 | Artikel | M09 | Cari + kategori | Paling Hangat, kategori (Semua 2/Tips 1/Berita 1/Motivasi/Panduan Ibu Bapa), 2 artikel "Contoh:" | ✅ | masih | Tajuk "Contoh:" (DATA) | v3-artikel-1280 |
| 22 | Cabutan Bertuah | M15 | Tiada cabutan | Cabutan Demo, Beli Tiket (0/10) | ✅ | masih | "Demo" (DATA) | v3-cabutan-1280 |
| 23 | Tournament | M16 | Dialih | "Tiada tournament aktif" | ✅ | masih | Tiada (DATA) | v3-tournament-1280 |
| 24 | Topik | M03 | Penapis, kad SP | Penapis tingkatan/subjek, kad subtopik (48) | ✅ | masih | Tiada | v3-topics-1280 |
| 25 | Peta Belajar | M03 | 14 tab | 7+ tab subjek, 0/1 topik | ✅ | masih | 1 topik (DATA) | v3-peta_belajar-1280 |
| 26 | Set Soalan Guru | M10 | Kosong | Kosong (murid4 dan maju); tiada set diterbitkan dalam seed | ✅ | masih | Aliran set berkelas tidak dapat diuji (DATA) | v3-set_soalan_saya-1280 |
| 27 | Audio KBAT | M09 | Kosong | Penapis + "Belum ada audio diterbitkan" | ✅ | masih | Tiada audio (DATA) | v3-audio_kbat-1280 |
| 28 | Syiling & Token | M14 | Hub + katalog 8 item | Tier + progres Perak, Tukar Token/Cabaran/Kedai, cabaran hari ini, transaksi | ⚠️ | masih | Tiada katalog hadiah pada hub | v3-gamification-1280 |
| 29 | Tukar Token | M14 | 50:1 | 50/250/Semua + jadual tier | ✅ | masih | Tiada (penukaran tidak dijalankan) | v3-gamification_convert-1280 |
| 30 | Cabaran Harian | M14 | 15 cabaran | 10 cabaran, "0 / 10 ganjaran dituntut" | ✅ | masih | Bilangan 10 lawan 15 (konfigurasi) | v3-gamification_challenges-1280 |
| 31 | Kedai Hadiah | M15 | Katalog dengan token, stok | "Tiada Hadiah Tersedia" | ⚠️ | masih | Katalog kosong (DATA). Mesej "tidak lama lagi" bersifat menunggu (D100) | v3-gamification_rewards-1280 |
| 32 | Marketplace | M20 | Kosong | Produk contoh, penapis | ✅ | masih | "Pesanan saya" tidak dilihat | v3-marketplace-1280 |
| 33 | Papan Pendahulu | M08/M14 | Tab kelas/sekolah, tempoh | `/gamification/leaderboard`: podium + 8 baris, tiada penapis. `/leaderboard`: penapis Semua Masa/Minggu/Bulan tetapi "1 peserta", "Kedudukan Anda #-" walau murid4 ada sesi | ⚠️ | masih | Dua papan tidak konsisten; menu menunjuk papan tanpa penapis | v3-gamification_leaderboard-1280, v3-leaderboard-1280 |
| 34 | Pencapaian | M14 | 3 lencana | 25 lencana + penapis; maju: "0/25 dicapai" tetapi "Langkah Pertama 1/1" | ✅ | masih | Ketidakkonsistenan kecil 0/25 vs 1/1 (belum dituntut?), tidak disahkan | v3-gamification_achievements-1280 |
| 35 | Kotak Misteri | M14 | 1 kotak syiling | 4 kotak token (2/5/10...) | ⚠️ | masih | Model berbeza dari V2 (keputusan spec V3) | v3-gamification_mystery_box-1280 |
| 36 | Rujuk Kawan | M14 | 100 syiling | 100 syiling untuk ANDA, kod, WhatsApp/Telegram | ✅ | ditutup | Pautan jemputan guna `localhost:8080` (konfigurasi persekitaran, bukan fungsi) | v3-gamification_referral-1280 |
| 37 | Cikgu Alesa | M13 | Tutor AI | 404 (disembunyi D102) | ✅ (mengikut keputusan) | masih | Tiada | v3-cikgu-1280 |
| 38 | Kedai Hadiah DIGITAL | L43 | Katalog digital | Penapis kategori, Tebusan Saya, "Tiada hadiah dalam kategori ini" | ⚠️ | masih | Katalog kosong (DATA) | v3-cikgu_hadiah-1280 |
| 39 | Timeline Saya | M08 | Suapan automatik | Suapan automatik ("Selesai latihan Sejarah 2/5") + Tambah Post | ✅ | ditutup | Pautan profil awam tidak diuji | v3-timeline-1280 |
| 40 | Jemput Ibu Bapa | L45 | Link, Salin, WhatsApp | Sama + Jana Link Baru + senarai ibu bapa | ✅ | masih | Tiada | v3-jemput_ibu_bapa-1280 |

Semakan lintang: tiada "Pratonton"/"akan datang"/"belum tersedia"/"prototaip" pada 46 laluan. Satu mesej menunggu ("Hadiah akan ditambah tidak lama lagi") di Kedai Hadiah. URL tidak dalam matriks (`/kombo`, `/misi-harian`, `/notifikasi`, `/target-spm`, `/profil-awam`) = 404 piawai.

## 4. Jurang teratas (ikut impak)

| # | Jurang | Jenis | Keterukan | Baris |
|---|---|---|---|---|
| 1 | Remedial tidak menjana pemulihan daripada subjek ketepatan <60% (V2 berbuat; V3 Sejarah 40% tetapi "Tiada topik lemah") | FUNGSI | Tinggi | 12 |
| 2 | Heatmap kosong untuk murid yang sudah menjawab 15 soalan; perlu disahkan sama ada pemetaan topik gagal | FUNGSI?/DATA | Tinggi | 14 |
| 3 | Serpihan data ujian kelihatan kepada murid: soalan "QA-GAP" di Dashboard Soalan Terkini, kertas "E2E fixture" di Bijak, banner/artikel "Contoh:", "DEMO" (D100) | DATA/hygiene | Sederhana-Tinggi | 2, 13, 20, 22 |
| 4 | Bijak SPM hanya 2 kertas; swa-markah Subjektif, widget dan stimulus pelbagai tidak dapat disahkan tanpa kertas | DATA | Tinggi | 13 |
| 5 | Soalan by Chapter: 1 bab/subjek, peraturan 70% tidak dinyatakan pada hero | DATA + salinan | Sederhana | 9 |
| 6 | Dua Papan Pendahulu tidak konsisten (`/leaderboard` "1 peserta" dan "#-" lawan `/gamification/leaderboard` 8 baris); menu menunjuk yang tiada penapis | FUNGSI | Sederhana | 33 |
| 7 | Kedudukan: tiada kad kedudukan sendiri/sekitar | FUNGSI | Sederhana | 18 |
| 8 | Dashboard: kad "Pakej SPM Aktif" tidak kelihatan | FUNGSI/data | Sederhana | 2 |
| 9 | Kedai Hadiah, Kedai Hadiah DIGITAL kosong; hub Syiling tiada katalog; mesej "tidak lama lagi" | DATA | Sederhana | 28, 31, 38 |
| 10 | Label ringkasan Latih Tubi "Kesukaran: Semua Tahap" salah; menu akaun menyimpan "Tiket Bantuan"/"Tukar Rakan Belajar" bertentangan PRD 2.3; pautan rujukan `localhost:8080` | Kecil | Rendah | 16, A5, 36 |

## 5. Tidak dapat disahkan

- Pandangan murid V2 dan V1 secara langsung: tiada akses pelayar (arahan Cloudflare) dan "log masuk sebagai" V2 tidak baca-sahaja (menulis `audit_logs`, log masuk sebagai murid sebenar). Perbandingan V2 bergantung pada kod dan nota 4 Nov. Perubahan pada V2 sejak 4 Nov tidak diperiksa.
- Murid T1-T3: tiada akaun demo (semua `grade` 10/11). Pintu T1 dan kandungan T1-T3 tidak diuji walaupun Latih Tubi memaparkan T1 5 soalan, T2/T3 0.
- Swa-markah Subjektif, Kertas Subjektif, Audio KBAT (tiada audio), Set Soalan Guru dengan set diterbitkan, Pakej SPM Aktif, simpan mood, Tiket Baru, penukaran token, pembelian cabutan, tebus hadiah, Tambah Post (tidak ditekan).
- Dark mode dan 320 px tidak diuji (hanya 375/768/1280).
- Baris "Peta Aktiviti 90 hari / Cadangan Latihan" pada Prestasi: teks dipotong, tidak disahkan.

## 6. Cadangan kemaskini PRD

| Fail | Seksyen/ID | Teks semasa | Cadangan | Bukti |
|---|---|---|---|---|
| `docs/prd/r1/10-murid.md` | 2.3 Account menu | "Tiket Bantuan (A4) is hidden" | Selaraskan: menu akaun V3 memaparkan Tiket Bantuan dan Tukar Rakan Belajar; sama ada tukar PRD atau buang item | v3-dashboard-1280 |
| `docs/prd/r1/10-murid.md` | 5 Summary table (row R1-MUR-3, 4, 6, 54, 14) | Missing/Wrong/Hidden | Kemas kini status: 3, 4, 6, 54 sudah ada; 14 perlu disahkan | Bahagian 2 |
| `docs/prd/r1/10-murid.md` | R1-MUR-12 Remedial | (deskripsi menjana remedial dari subjek lemah) | Tegaskan peraturan V2: subjek ketepatan <60% + senarai set selesai (`StudentController::remedial`) sebagai AC; belum dipenuhi | kod V2, v3-remedial_saya-1280 |
| `docs/prd/r1/10-murid.md` | R1-MUR-33 Papan Pendahulu | Papan ber-penapis | Tentukan satu papan sahaja (menu `/gamification/leaderboard` tiada penapis, `/leaderboard` tidak konsisten) | v3-leaderboard-1280 |
| `docs/prd/r1/10-murid.md` | 4.11 | Senarai "akan datang" | Tambah: "Hadiah akan ditambah tidak lama lagi" (Kedai Hadiah) | v3-gamification_rewards-1280 |
