# Analisis Jurang MURID: V3 lawan V1 dan V2 (2026-11-03)

Kaedah dan sumber:
- V2 (prestasiplus.cloud): dibuka LIVE dalam Playwright lane 1 sebagai murid ujian (baca sahaja; tiada penghantaran, tiada mula kuiz/Simulasi). Teks, bahagian, butang dan kiraan di bawah ialah apa yang dilihat pada halaman, disambung dengan kod V2 dan `docs/discovery/v2-parity/student.md`.
- V3 (localhost:5193, murid demo): dibuka LIVE selepas V2; satu kuiz Latih Tubi dijalankan sehingga "Semak Jawapan". Punca kod di branch `feature/v3-bijak-r1`.
- V1 (prestasiplus.my): tiada log masuk murid; diambil daripada dokumen discovery (M05, M08, R10, M14 dll). Folder `roles-matrix\murid\` tiada dalam repo (hanya xlsx), jadi tangkapan sidebar V1 tidak dapat dirujuk.
- Pintasan bukti: `[V2]` = `.evidence/ (lokal, tidak dalam repo) screenshots/v2/v2-pupil-<laluan>.png`; `[V3]` = `.evidence/screenshots/v3-github/murid-<laluan>.png`; `[GM]` = `.evidence/gap-murid\`. Teks halaman dirakam terus dalam sesi (tiada skrin tangkap baharu kecuali `[GM]\v3-quiz.png`).
- Had: bahagian dalam Bijak SPM/Simulasi V3 (jawapan, semakan, swa-markah) tidak diuji semula; dipetik daripada audit parity 2026-10-30 (ditanda "parity doc"). Data V3 ialah seed demo kecil, V2 ialah data produksi; jurang kandungan dan fungsi dinyatakan bersama.

Status: Sepadan / Sebahagian / Disekat-Hilang. Keterukan: Kritikal / Tinggi / Sederhana / Rendah.

## 1. Baris Murid 1.0 (mendalam)

| # | Modul | 1.0? | V1 | V2 (dilihat live) | V3 (dilihat live) | Jurang V3 (fungsi) | Keterukan | Bukti |
|---|---|---|---|---|---|---|---|---|
| A1 | Profil Saya | Ya | Profil + kemas kini (M01) | Kad profil (sekolah, ahli sejak), "Profil Awam Saya" + pautan kongsi + Salin, statistik (koin, streak, level, hari berlatih, sesi, ketepatan), borang Bio + Cita-Cita (Simpan), Kombo hari ini/rekod, Koleksi Lencana, Kalendar Kombo 30 hari, Sesi Terkini (mod/betul/ketepatan/koin) | Nama, e-mel, ahli sejak, butang "Kemaskini Profil" sahaja | Tiada pautan profil awam, bio/cita-cita, statistik, lencana, kalendar kombo, sesi terkini | Tinggi | [V2] profile; [V3] profile |
| A2 | Tetapan Peribadi | Ya | Tetapan akaun (M01) | "Tetapan Akaun": kad baca-sahaja (e-mel, telefon, sekolah, peranan, status) | Halaman "Mod Rohani" (togol doa, push Subuh dll); maklumat akaun tidak terlihat | Kandungan berbeza; maklumat akaun/tukar kata laluan tidak terlihat (`me/password` wujud menurut parity doc, tidak diuji) | Sederhana | [V3] tetapan |
| A3 | Panduan | Ya | Panduan pengguna | Pilih peranan (Pelajar/Guru/Ibu Bapa/Admin/PPD), langkah daftar, "Apa yang boleh anda buat", Tiket Bantuan | Sama (5 peranan, langkah daftar) | Tiada (V3 tulis "Tingkatan 1-5", V2 "Darjah 1-Tingkatan 5": keputusan D72) | Rendah | [V2] panduan; [V3] panduan |
| A5 | Log Keluar | Ya | Ada | Ikon keluar di header | Menu akaun: Profil Saya, Tetapan, Panduan, Tiket, Tukar Rakan Belajar, tema gelap, Log Keluar | Tiada | Rendah | menu akaun V3 (dilihat live) |
| 2 | Dashboard | Ya | Dashboard murid (M05-T3) | Salam, kad Pakej SPM Aktif (sah sehingga), Kombo (butang Belum, rekod terbaik, amaran akan putus), 5 kiraan (syiling, mata, streak, sesi minggu, ketepatan), Misi Harian 1/3 + peti, check-in mood (Gembira/Okay/Sedih/Tertekan), Cabaran Kilat, panel Artikel Untuk Kamu, Subjek Tersedia, Soalan Terkini | Salam + rakan belajar (Aiman), kad streak/koin/mata, "Teruskan Latih Tubi" 0/10 misi, Percubaan Percuma 50/50, banner HERO/PROMO, 5 kiraan, Misi Harian 0/10 + peti, lencana kosong, 5 pintasan (Mula Latihan, Soalan Aku Salah, Kemajuan, Sejarah, Papan Pendahulu), Artikel, Subjek Tersedia (31), Tingkatan 4/5 | Tiada: Pakej SPM Aktif, kad Kombo, check-in mood (tiada FE/BE, parity C01), Cabaran Kilat, Soalan Terkini. Tambahan V3 (bukan V2): banner, Percubaan Percuma, rakan belajar, 10 misi (V2 3 misi) | Sederhana | [V2] dashboard; [V3] dashboard |
| 3 | Headcount | Ya | Murid ditolak (FR-M08-08, diperhatikan di V1) | Halaman "Headcount - Tracking prestasi murid" dengan keadaan kosong "Belum ada Headcount... Guru anda belum menyediakan"; Auto-Setup | Menu disembunyi; `/headcount` = 403 Akses Ditolak | Murid tidak boleh melihat Headcount walaupun baris 1.0 Murid | Tinggi | [V2] headcount; `user-nav.ts` `STUDENT_HIDDEN_IDS`; `routes/headcount.ts` |
| 4 | Prestasi | Ya | `/prestasi` ialah Dashboard Sekolah untuk admin; paparan murid tidak diperhatikan | "Prestasi 360 - Dashboard Individu": ketepatan, hari kombo, sesi, soalan dijawab, masa belajar, Headcount-Prestasi SPM, Trend, Peta Aktiviti 90 hari, Cadangan Latihan, Penguasaan Subjek | `/prestasi` dialih ke `/prestasi/sekolah` "Dashboard Sekolah": 6 kelas, 17 murid, 4 guru, GPS sekolah, taburan gred, Prestasi Guru, Navigasi Pantas | Murid melihat data seluruh sekolah (bukan miliknya) dan tiada Prestasi 360 sendiri. Salah paparan dan kebocoran data | Kritikal | [V3] prestasi; `routes/prestasi.ts:29`; `PRESTASI_SCHOOL_ROLES` memasukkan `student`; `/prestasi/:userId` (analitik.ts:30) wujud |
| 5 | Analitik Adaptif | Ya | Analitik Pembelajaran (M08-S7) | Tab 14 subjek, "0/26 SP", Standard Dikuasai/Mahir/Sederhana/Lemah/Belum Cuba, peta DSKP mengikut kemahiran, mesej "belum ada latihan" | Topik Perlu Perhatian, SP Standard, trend 30 hari, unjuran gred, peta DSKP, Fokus; hanya subjek Matematik | Pemilih subjek hanya subjek berdata (1) | Rendah | [V2] analitik_pelajar; [V3] analitik_pelajar |
| 6 | Analisa Item | Ya | Hanya Guru/Admin (S9-S11) | "Analisa Item" peribadi: Soalan Dijawab, Perlu Pemulihan, Perlu Pengukuhan, Tahap Penguasaan, keadaan kosong + "Mula Berlatih" | Menu disembunyi; `/analisa-item` dialih ke Dashboard | Murid tiada skrin Analisa Item | Tinggi | [V2] analisa_item; `analisa-item.ts:43` `analisaItemTarget`; `STUDENT_HIDDEN_IDS` |
| 7 | Video | Ya | Video (M09) | Tab kategori (Semua/Motivasi/Tutorial/Tips SPM/Ceramah/Lain-lain) + kiraan; keadaan kosong | Tab kategori sama + 3 video seed + "Tambah Video" | Tiada | Rendah | [V3] video |
| 8 | Kelas Saya | Ya | Kelas Saya (M10) | "Anda belum dimasukkan ke dalam kelas" (guru tambah murid) | Kotak "Masukkan Kod Kelas" + Sertai, senarai 2 kelas | Tiada (V3 tambah sertai-kod, parity C07) | Rendah | [V2] kelas_saya; [V3] kelas_saya |
| 9 | Soalan by Chapter | Ya | `/practice/chapter` > subjek > bab > 5/10/15/20 soalan; bab berikut dibuka pada 70% (M05) | Hero "Mode Sistematik", peraturan 70%, butang Latih Tubi Rawak, 14 kad subjek (BM 26 bab ... Fizik 97 bab) | Hero sama tetapi tanpa 70%; satu subjek (Sejarah) dengan "Tiada bab tersedia" | Bab/soalan tiada, peraturan 70% tidak dinyatakan; aliran bab ke kuiz tidak boleh diuji | Tinggi | [V2] latihan bab (latih_tubi_bab); [V3] practice_chapter; parity C08 |
| 12 | Remedial | Ya | Remedial (M05) | "Ujian Remedial Saya": "PERLU PEMULIHAN SEKARANG", Sains 120 soalan, ketepatan 0.0%, sasaran 60%, "Latihan Pemulihan" | "Tiada ujian remedial. Bagus" | V2 menjana kad pemulihan daripada ketepatan subjek rendah; V3 tidak terbukti menjana (hanya yang ditugaskan) | Sederhana | [V2] remedial_saya; [V3] remedial_saya |
| 13 | SPM (Bijak SPM / Simulasi) | Ya | Hub SPM (M06) | Hub: Databank 408,197 soalan, Tracking A 1,744, Subjektif 4,061 set, Bijak SPM 69 set, "Prestasi SPM Anda". `/simulasi`: Bahasa Inggeris 11 set, Geografi 10, Perniagaan 10, Sejarah 6 ..., kad Set/Kertas/markah | Hub: Databank 492, Tracking A 370, Subjektif 3 set, Latih Tubi SPM, kad Bijak SPM. `/spm/bijak`: Kertas Pilihan (2 kertas, 1 sedang dijawab), Jana Kertas, Simulasi-Kuiz, Sejarah | Kandungan: 2 kertas lawan 69 set. Fungsi (parity doc): tiada swa-markah subjektif, widget jawapan 8 daripada 14 mod, stimulus 3 daripada 15 jenis, tiada Cuba Lagi di keputusan; V3 tambah Mod Latihan, Jana Kertas | Tinggi | [V2] spm, simulasi; [V3] spm, spm_bijak; parity B07, B08, B15, B16, B20 |
| 14 | Heatmap Topik Lemah | Ya | R10-S1 `/buku-nota/heatmap` | Legenda 4 warna, keadaan kosong + "Mula Latih Tubi" | Legenda sama, 1 sel (Fungsi dan Persamaan Kuadratik 80%) | Tiada | Rendah | [V2] buku_nota_heatmap; [V3] buku_nota_heatmap |
| 16 | Latih Tubi (tambahan 1.0) | Ya (pengguna) | `/practice` subjek > tahap > kesukaran > bilangan (M05) | `/practice` dialih ke Dashboard (bendera latih-tubi OFF produksi) | Senarai subjek (kiraan soalan), Pilih Tahap, Kesukaran, Bilangan 5-20, Ringkasan, Mula Kuiz; kuiz: kombo, pemasa, Semak Jawapan, "Betul! +10", Soalan Seterusnya, Lapor Soalan | Tiada jurang vs V1. Penjelasan jawapan tidak terlihat pada seed ini | Rendah | [GM]\v3-quiz.png; [V3] practice |
| 21 | Permainan | Ya | Permainan/Battle (M16) | `/permainan` dialih ke Dashboard (OFF); `/battle` ada: Ranking Pelajar/Sekolah, pilih subjek, bilangan soalan, Quick Match, Cabar Kawan, Battle Sekolah | Zon Permainan: Papan Bijak, Battle Arena, Perang Fakta, Benteng Ilmu, Perlumbaan Matematik, Kuiz Relay, Roda dll | V3 melebihi V2 | Rendah | [V2] battle; [V3] permainan |
| 54 | Laporan Soalan | Ya (1.0 sahaja) | `/laporan-soalan` (M04-S13) | "Laporan Soalan Saya": Jumlah/Menunggu/Disemak/Diperbaiki/Ditolak + keadaan kosong | `/laporan-soalan` dialih ke Dashboard; tiada menu. Butang "Lapor Soalan" dalam kuiz ada | Murid boleh hantar laporan tetapi tidak boleh menjejak status | Tinggi | [V2] laporan_soalan; `routes/my-reports.ts` wujud tetapi disekat `prototype-scope.ts` (D43) |

## 2. Baris Murid selebihnya (kehadiran + fungsi utama)

| # | Modul | V1 | V2 (live) | V3 (live) | Jurang V3 | Keterukan | Bukti |
|---|---|---|---|---|---|---|---|
| A4 | Tiket Bantuan | M22 | Tapis status (Semua/Dibuka/Dalam Proses/Menunggu Balas/Selesai/Ditutup), Tiket Baru | Sama + 1 tiket contoh | Tiada | Rendah | [V3] pusat_tuisyen_tiket |
| 15 | Mohon Keluarga Angkat | M21-S6 | Borang: e-mel pelajar, kategori (B40/Asnaf/Yatim/OKU), pendapatan, sebab | 404 (bendera `VITE_KELUARGA_ANGKAT` OFF, D74) | Hilang ikut keputusan D74 | Sederhana | `features.ts` |
| 17 | Soalan Berstruktur | M04/M05 | Penapis Subjek (31), Aras KBAT (HOTS/MOTS/LOTS), Cari | Penapis sama, 3 set seed | Kandungan sahaja | Rendah | [V2] latihan_berstruktur; [V3] latihan_berstruktur |
| 18 | Kedudukan | M08 `/ranking` Nasional/Negeri/Daerah/Sekolah | Kad kedudukan sendiri (sekolah #406/864, negeri, kebangsaan, "Kumpulan 47% teratas") + "Sekitar anda" + pautan papan penuh | Penapis Skop/Subjek/Tingkatan; "Tiada data kedudukan" walaupun murid ada 374 syiling | Tiada kad kedudukan sendiri/sekitar; senarai kosong | Sederhana | [V2] ranking; [V3] ranking |
| 19 | PKSK | M07 | Terkunci tanpa akses (tiada pakej), 748 soalan, 3 bahagian, 12 domain | Terbuka (AKTIF T1/T4), format A/B/C | Mesej akses sekolah tidak diuji (akaun demo berpakej) | Rendah | [V2] pksk; [V3] pksk |
| 20 | Artikel | M09 | Cari + kategori, senarai bacaan | Sama + Paling Hangat | Tiada | Rendah | [V2] artikel; [V3] artikel |
| 22 | Cabutan Bertuah | M15 | Tiada cabutan dibuka | Cabutan Demo, Beli Tiket (50, 0/10) | Tiada | Rendah | [V2] cabutan; [V3] cabutan |
| 23 | Tournament | M16 | `/tournament` dialih ke Dashboard (tiada) | Halaman Liga & Tournament (kosong) | V3 melebihi | Rendah | [V3] tournament |
| 24 | Topik | M03 | Penapis subjek, kad SP "0 soalan tersedia" | Penapis tingkatan + subjek, kad subtopik | Tiada | Rendah | [V3] topics |
| 25 | Peta Belajar | M03 | 14 tab subjek, topik mengikut SP "Belum tersedia" | 7 tab subjek, 3 topik Matematik, kemajuan 7% | Kandungan | Rendah | [V2] peta_belajar; [V3] peta_belajar |
| 26 | Set Soalan Guru | M10 | Keadaan kosong | Keadaan kosong | Tiada | Rendah | [V3] set_soalan_saya |
| 27 | Audio KBAT | M09 | Kosong ("Belum ada audio diterbitkan") | Penapis Tahap/Subjek, Ujian Mendengar | Tiada | Rendah | [V2] audio_kbat; [V3] audio_kbat |
| 28 | Syiling & Token | M14 | Hub: syiling, token, mata, tier, katalog Kedai Hadiah Digital (8 item), jadual tier, transaksi | Hub tier + progres ke Perak, pautan Tukar/Cabaran/Kedai, ringkasan cabaran, transaksi | Tiada katalog pada hub | Rendah | [V2] gamification; [V3] gamification |
| 29 | Tukar Token | M14 | 50:1 Gangsa, kadar tier, sejarah | Sama + pilihan jumlah (50/250/Semua) | Tiada | Rendah | [V2] gamification_convert; [V3] gamification_convert |
| 30 | Cabaran Harian | M14 | 15 cabaran/hari ("0 / 15 ganjaran dituntut") | 10 cabaran | Bilangan berbeza | Rendah | [V2]/[V3] gamification_challenges |
| 31 | Kedai Hadiah | M15 | Katalog (Genshin, Hotlink, MLBB, PUBG, TnG) dengan token, stok, penapis kategori | "Tiada Hadiah Tersedia" | Katalog kosong; tiada penapis | Sederhana | [V2] gamification_rewards; [V3] gamification_rewards |
| 32 | Marketplace | M20 | Kosong, "Pesanan saya" | Produk contoh, penapis kategori/keadaan/susun, diskaun | V3 lebih; "Pesanan saya" tidak terlihat | Rendah | [V3] marketplace |
| 33 | Papan Pendahulu | M08/M14 | Tab Kelas/Sekolah, Semua Masa/Minggu/Bulan, kedudukan anda, podium | Podium + 3 baris, tiada penapis tempoh/skop | Penapis tempoh/skop dan kedudukan sendiri tiada | Sederhana | [V2] leaderboard; [V3] gamification_leaderboard |
| 34 | Pencapaian | M14 | 3 lencana | 25 lencana, penapis Biasa/Jarang/Epik/Legenda | V3 melebihi | Rendah | [V3] gamification_achievements |
| 35 | Kotak Misteri | M14 | Satu kotak 50 syiling, jadual peluang (10-500 syiling, 1-3 token), sejarah kotak | 4 kotak (2/5/10 token), julat ganjaran | Model berbeza (syiling lawan token) | Sederhana | [V2] gamification_mystery_box; [V3] mystery_box |
| 36 | Rujuk Kawan | M14 | Kod + pautan, 100 syiling setiap kawan, bilangan kawan, bonus | Kod + WhatsApp/Telegram, 50 syiling anda / 25 kawan | Peraturan ganjaran berbeza | Sederhana | [V2] gamification_referral; [V3] referral |
| 37 | Cikgu Alesa | M13 | `/cikgu` Tutor AI + pilih subjek (31) | 404 (disembunyi, D73) | Hilang ikut keputusan D73 | Sederhana | `features.ts` `isAlesaAiOn` |
| 38 | Kedai Hadiah DIGITAL | L43 | Katalog digital (hub + rewards) | `/cikgu/hadiah`: penapis kategori, Tebusan Saya, "Tiada hadiah" | Katalog kosong | Sederhana | [V3] cikgu_hadiah |
| 39 | Timeline Saya | M08 | Suapan aktiviti automatik ("Selesai latihan Sains 0/40") + pautan profil awam | Pos manual (Cerita/Aktiviti/Pencapaian), Tambah Post | Model berbeza; tiada suapan automatik/profil awam | Sederhana | [V2] timeline; [V3] timeline |
| 40 | Jemput Ibu Bapa | L45 | Link, Salin, WhatsApp, Jana Link Baru, senarai ibu bapa | Sama | Tiada | Rendah | [V3] jemput_ibu_bapa |

## 3. Item menu V3 tanpa baris matriks (extras)

- Bijak SPM (BARU) sebagai item sendiri; matriks meletakkannya di bawah SPM (13).
- Pintasan dashboard: Soalan Aku Salah (`/practice/revision`), Kemajuan (`/practice/progress`), Sejarah Latihan (`/practice/history`), Papan Pendahulu kedua (`/leaderboard`); `/gamification/leaderboard` ialah duplikat.
- Menu akaun: Tukar Rakan Belajar (Aiman/Aisyah), tema gelap. Dashboard: banner HERO/PROMO, "Percubaan Percuma 50/50 soalan".
- Dalam kod tetapi disembunyi/dialih ke Dashboard: Target SPM, Misi Harian, Notifikasi, Sekolah Bersaing (V2 ada). V2 juga ada Kombo, Laporan Mingguan, Pembetulan, Penguasaan, Cita-Cita, Pusat Kerjaya, Psikometrik, Buku Nota, Pusat AI, Battle, Bilik Duta dan Billing yang tiada dalam matriks.

## 4. Ringkasan

Baris Murid 1.0 (18 baris termasuk Latih Tubi):

| Status | Bilangan | Baris |
|---|---|---|
| Sepadan | 7 | A3, A5, 7, 8, 14, 16, 21 |
| Sebahagian | 7 | A1, A2, 2, 5, 9, 12, 13 |
| Salah paparan / Disekat | 4 | 3, 4, 6, 54 |

Skop penuh (25 baris Murid lain termasuk A4): Sepadan 17, Sebahagian 6 (18, 31, 35, 36, 38, 39), Hilang 2 (15, 37; keputusan produk D74/D73). Gabungan 43 baris: Sepadan 24, Sebahagian 13, Hilang/Disekat 6.

### 15 jurang fungsi teratas

| # | Jurang | Keterukan | Punca kemungkinan |
|---|---|---|---|
| 1 | Prestasi murid memaparkan Dashboard Sekolah (data seluruh sekolah) bukan Prestasi 360 sendiri | Kritikal | `routes/prestasi.ts:29` redirect `/prestasi` ke `/prestasi/sekolah` untuk semua peranan; `student` dalam `PRESTASI_SCHOOL_ROLES`; `/prestasi/:userId` tidak dijadikan halaman utama murid |
| 2 | Laporan Soalan Saya (baris 54) tidak boleh dicapai | Tinggi | Skop prototaip D43 (`prototype-scope.ts`) menyekat `/laporan-soalan`; tiada item menu murid walaupun halaman wujud (`my-reports.ts`) |
| 3 | Headcount murid ialah 403 | Tinggi | `STUDENT_HIDDEN_IDS` + peranan route `headcount.ts`; V2 memaparkan halaman dengan keadaan kosong |
| 4 | Analisa Item murid dialih ke Dashboard | Tinggi | `analisa-item.ts:43` `analisaItemTarget(role)` tiada sasaran murid; V2 ada halaman peribadi |
| 5 | Kandungan SPM: Databank 492 lawan 408,197; Bijak 2 lawan 69 kertas | Tinggi | Seed demo; paip kertas D85 belum menerbitkan; `spmPool:false` pada cipta soalan (parity C11, B20) |
| 6 | Soalan by Chapter: 1 subjek 0 bab lawan 14 subjek (26-97 bab); peraturan 70% tidak dinyatakan | Tinggi | `curriculum_nodes` kosong + jambatan MCQ `be09-practice-mapping` (parity C08); salinan hero tanpa 70% |
| 7 | Bijak SPM: tiada swa-markah subjektif, 8/14 widget jawapan, 3/15 jenis stimulus, tiada Cuba Lagi (parity doc, tidak diuji semula) | Tinggi | `PartResultCard.vue`, `PartInput.vue`, `StimulusView.vue`; tiada endpoint self-mark |
| 8 | Profil Saya nipis: tiada profil awam, bio/cita-cita, statistik, lencana, kalendar kombo, sesi terkini | Tinggi | Halaman `/profile` ringkas |
| 9 | Dashboard kekurangan Pakej SPM Aktif, kad Kombo, check-in mood, Cabaran Kilat, Soalan Terkini | Sederhana | Tiada FE/BE mood (parity C01); `/kombo` di luar skop |
| 10 | Kedudukan: tiada kad kedudukan sendiri/sekitar; senarai kosong walau ada syiling | Sederhana | `/ranking` dibina sebagai penapis V1; kedudukan belum dikira untuk murid demo (tidak disahkan) |
| 11 | Remedial tidak menjana pemulihan daripada subjek lemah | Sederhana | Hanya `remedial-tests/mine` (ditugaskan) |
| 12 | Kedai Hadiah / Kedai Hadiah Digital kosong | Sederhana | Katalog `shop` tidak diseed |
| 13 | Tetapan Peribadi: Mod Rohani sahaja, maklumat akaun tidak terlihat | Sederhana | Halaman `/tetapan` mengikut spesifikasi V3 |
| 14 | Model ganjaran berbeza (Rujuk 50/25 vs 100; Kotak Misteri 4 kotak token vs 1 kotak syiling; Timeline manual vs suapan auto) | Sederhana | Peraturan M14/M08 V3 mengikut spec sendiri, bukan V2 |
| 15 | Cikgu Alesa dan Mohon Keluarga Angkat disembunyi; Misi Harian, Target SPM, Sekolah Bersaing, Notifikasi dialih ke Dashboard | Sederhana | Bendera D73/D74 dan skop prototaip D43 |

Catatan: Analitik Adaptif, Video, Kelas Saya, Heatmap, Latih Tubi, Permainan dan Panduan padan atau melebihi V2 pada fungsi. Pelayar lane 1 ditinggalkan log masuk sebagai murid demo V3 (V2 juga masih berlog masuk dalam pelayar yang sama sebelum ini).
