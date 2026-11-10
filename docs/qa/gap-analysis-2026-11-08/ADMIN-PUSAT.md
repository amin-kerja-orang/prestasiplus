# Analisis jurang: Admin Pusat V3-local vs V2 / V1 (kemas kini 2026-11-08)

Tarikh: 2026-11-08. Pangkalan perbandingan: `docs/qa/gap-analysis-2026-11-04/ADMIN-PUSAT.md` dan `FUNCTIONAL-E2E.md`.
Penamaan: V1 = prestasiplus.my, V2 = prestasiplus.cloud (`/admin` Blade) + Panel React, V3-local = `http://localhost:5194` (HEAD b50fa8d41, seed demo, `admin@demo.test`).

## 0. Kaedah dan had (baca dahulu)

- **V3-local: diperhatikan sendiri** dalam pelayar (lorong 3, kepala): menu sidebar, 56 laluan `/admin/*` disemak satu persatu, aliran F1-F9, semakan responsif 17 skrin x 3 saiz. Data ujian "QA-GAP" ditinggalkan (soalan 1292-1295, kumpulan rangsangan #3, set 7, kelompok ekstrak 1, kiriman guru 1).
- **V1/V2 live: TIDAK dilayari langsung.** Arahan pemimpin (jangan sampai disekat Cloudflare; kod dan pelayan dahulu) diterima di tengah kerja. Saya memilih tidak log masuk ke V1/V2 langsung (lorong 3 dikongsi IP dengan dua ejen lain; percubaan log masuk 4 Nov juga ditolak pengelas kebenaran). Tiada halaman Cloudflare ditemui kerana tiada akses dibuat. Lajur V1/V2 di bawah berasaskan: kod V2 (`D:\Dev Projects\prestasiplus-reference\backend\routes\web.php`, route admin disahkan wujud), sidebar V2 (90) dan V1 (87) yang ditangkap 4 Nov (tidak diperhatikan semula hari ini), dan PRD `30-admin-pusat.md`. Pelayan produksi V2 tidak diakses (perlu kata laluan SSH; tiada agregat data diambil).
- Matriks `docs/Matriks-Akses-Peranan .xlsx` TIDAK ada lajur "Admin Pusat". Lajurnya: Murid, Guru, Admin Sekolah dan versi 1.0 (Murid/Guru/Admin Sekolah 1.0). Seperti garis dasar 4 Nov, baris #1-#54 dianggap "modul yang mesti boleh diurus Admin Pusat". "Baris 1.0" = baris yang ada tanda pada sekurang-kurangnya satu lajur 1.0: 29 baris (#1-14, #21, #41-54).
- Definisi penanda: ✅ skrin dibuka dan fungsi utama dilihat berfungsi; ⚠️ separa (skrin ada tetapi ada yang tiada, atau tulis/CRUD tidak dijalankan); ❌ tiada skrin (`/admin/...` = 404); n/a = V1 dan V2 sendiri tiada pengurusan khusus. Perubahan: ditutup / masih / baru rosak / baru ada.
- Data demo kecil: senarai kosong ditanda "(data)" jika puncanya data, bukan kod.

## 1. Ringkasan (scoreboard)

| Ukuran | 4 Nov | 8 Nov |
|---|---|---|
| 54 modul: diurus penuh ✅ | 8 | **12** (+#9, #10, #32, #41) |
| Separa ⚠️ | 10 | **9** (#6, 7, 13, 16, 17, 25, 26, 44, 54) |
| Tiada skrin ❌ | 32 | **29** |
| Tiada jurang (n/a) | 4 | 4 (#12, 14, 18, 39) |
| Baris 1.0 (29): penuh / separa / tiada / n/a | 4 / 7 / 16 / 2 (diterbitkan semula daripada jadual 4 Nov) | **7 / 5 / 15 / 2** |
| Item menu ditakrif / dibina (`menu.ts`) | 106 / 40 | 106 / **46** (60 belum) |
| Pautan sidebar Admin Pusat dipaparkan | tidak dikira | **40** dalam 8 kumpulan (+ logo `/admin`) |
| Sasaran menu PRD 47 | 47 | masih 9 item pendua/patut digabung; lihat bahagian 4 |

Kesimpulan: kemajuan sebenar sejak 4 Nov ada pada jalur soalan dan kandungan: Sumber Kertas, Kertas Subjektif, Video, Marketplace (produk + penjual), Tiket Bantuan, Tetapan (hubungi sokongan), Kiriman Guru berfungsi, Kontrak Simulasi ada 1 "Disahkan", kawalan "Jawab Semua / Pilih N" dalam Set Builder, PDF tidak lagi tersangkut. **Seluruh ekonomi murid (Gamifikasi, Hadiah, Permainan, Cabutan, Tournament), Kawalan Ciri, analitik/laporan pusat, penajaan, notifikasi, audit log, bayaran dan chatbot masih 404** (22 daripada 29 modul ❌ ialah modul murid yang murid nampak tetapi admin tidak boleh urus).

## 2. Jadual modul (matriks #1-#54)

Lajur V1/V2: dari sidebar/kod, bukan pemerhatian hari ini. Bukti = laluan V3 yang dibuka atau fail dalam `.evidence/gap-2026-11-08/admin/`.

| # | Modul | V1 | V2 | V3-local (8 Nov) | Penilaian | Perubahan | Yang tiada / catatan | Bukti |
|---|---|---|---|---|---|---|---|---|
| 1 | Command Center | `/admin/command-center` | + `/live` | `/admin/command-center` (Langsung) + Aktiviti Harian, 4 kad, Top Sekolah, Mood | ✅ | masih | "0 Sekolah Berdaftar" walaupun ada 4 sekolah (langganan 0: data) | v3-home-1280.png |
| 2 | Dashboard | `/admin` | `/admin` | `/admin` hanya redirect ke Command Center; PP-01 belum | ❌ | masih | Dashboard pusat | route probe |
| 3 | Headcount | Dashboard | Dashboard | `/admin/laporan-sekolah/headcount` 404 | ❌ | masih | PM-24 | probe |
| 4 | Prestasi | Laporan/Analitik | `/admin/analytics` | `/admin/analytics` 404 | ❌ | masih | PM-04/25 | probe |
| 5 | Analitik Adaptif | Analitik | Analitik | tiada | ❌ | masih | PM-26 | probe |
| 6 | Analisa Item | Kualiti Soalan | Analitik/Kualiti | `/admin/questions/quality`: tab Kualiti dibuka; 526 soalan, purata skor 0.0 (audit belum dijalankan) | ⚠️ | masih | Analisis item pusat tiada; skor kualiti kosong sehingga "Jalankan Audit Semula" | probe |
| 7 | Video | tiada | Filament `/admin-filament/videos` | `/admin/videos` ada, butang Tambah Video, penapis subjek, senarai kosong | ⚠️ | **baru ada** (ditutup sebahagian) | CRUD tidak dijalankan; data kosong (data) | probe |
| 8 | Kelas Saya | Pengguna/Sekolah | sama | `/admin/classes` 404 | ❌ | masih | PS-03 | probe |
| 9 | Soalan by Chapter | Senarai Soalan + Kurikulum | Studio + Kurikulum | Studio cipta soalan dengan Bab, Topik (unit DSKP) dan kotak SP DSKP; murid nampak Bab 1 Matematik T4 (10 soalan) | ✅ | **ditutup** (DSKP kini boleh ditag) | Topik tidak ditapis mengikut Bab (G-02); soalan 1292 (Bab 7) tidak muncul dalam Soalan by Chapter | v3-studio-edit-1292.png |
| 10 | Monitoring | `/admin/monitoring` | + CSV/PDF | menu kini `/admin/monitoring` (penapis tempoh, negeri) | ✅ | **ditutup** (laluan menu sepadan) | eksport CSV/PDF tidak disahkan | probe |
| 11 | Kirkpatrick | 7 skrin | 7 skrin + PDF | `/admin/kirkpatrick` 7 tab | ✅ | masih | eksport PDF tidak disahkan | probe |
| 12 | Remedial | - | - | - | n/a | masih | - | - |
| 13 | SPM / Bijak SPM | Import CSV, Senarai Soalan, `/spm/*` | hub 6 lorong, Set Builder, Kontrak, Tracking A, Kertas Subjektif, Sumber Kertas | hub 5 kad (Databank 500, Subjektif 18, Bijak SPM 6, Kertas Subjektif 0, Latih Tubi 520); Sumber Kertas, Kertas Subjektif, Kontrak (1 Disahkan) wujud; **Tracking A 404** | ⚠️ | separa ditutup | Tracking A; Kertas Subjektif dan Sumber Kertas kosong (data); Jana set tersekat (G-04); kertas fixture #1 rujuk 10 ID soalan tidak wujud (data) | v3-setbuilder-jana.png |
| 14 | Heatmap Topik Lemah | - | - | - | n/a | masih | - | - |
| 15 | Mohon Keluarga Angkat | Penajaan, Anak Angkat | sama | `/admin/sponsors`, `/admin/anak-angkat` 404 | ❌ | masih | peluluskan permohonan | probe |
| 16 | Latih Tubi | `/spm/latih-tubi` | lorong + Kawalan Ciri | `/admin/spm/latih-tubi` lorong 520 item (tiada dalam menu, hanya dari hub) | ⚠️ | **baru ada** | togol/kawalan ciri tiada | probe |
| 17 | Soalan Berstruktur | `/admin/structured-questions` | + penyunting rubrik | senarai 18 soalan + butiran (bahagian, jawapan model) + butang Tambah; **tiada dalam menu** | ⚠️ | separa ditutup | edit rubrik tidak dijalankan; menu tiada | probe |
| 18 | Kedudukan | - | - | - | n/a | masih | - | - |
| 19 | PKSK | PKSK Soalan + Akses | sama | Soalan PKSK + Akses PKSK dalam menu (soalan 0: data) | ✅ | masih | tulis tidak dijalankan | probe |
| 20 | Artikel | Artikel, Banner | sama | Banner, Artikel, Nota dalam menu | ✅ | masih | tulis tidak dijalankan | menu |
| 21 | Permainan | Tetapan Permainan | `/admin/permainan` | 404 (`/admin/permainan`, `/admin/games`) | ❌ | masih | BE `admin/games` ada | probe |
| 22 | Cabutan Bertuah | Kawalan Reward | Filament lucky-draws | 404 | ❌ | masih | | probe |
| 23 | Tournament | Battle Live | sama | 404 | ❌ | masih | | probe |
| 24 | Topik | Kurikulum | Kurikulum | `/admin/curriculum` tab Bab + DSKP; Subjek, Tahap Pendidikan | ✅ | masih | | probe |
| 25 | Peta Belajar | Kurikulum | Kurikulum | sama #24 | ⚠️ | masih | tiada paparan Peta Belajar sendiri | probe |
| 26 | Set Soalan Guru | Kertas Soalan Guru | tab Kiriman Guru | `/admin/question-submissions` kini hidup: 1 kiriman guru muncul (soalan guru QA); tab Kiriman Guru dalam Import & Semakan; **tiada dalam menu** | ⚠️ | **ditutup (F9 admin kini nampak)** | muat naik kertas PDF oleh guru tidak diuji semula (4 Nov: 503) | probe |
| 27 | Audio KBAT | Audio KBAT | sama | menu Audio KBAT | ✅ | masih | | menu |
| 28 | Syiling & Token | Gamifikasi | sama | `/admin/gamification` 404 | ❌ | masih | BE `admin/gamification` ada | probe |
| 29 | Tukar Token | Tier Config | sama | `/admin/gamification/tiers` 404 | ❌ | masih | | probe |
| 30 | Cabaran Harian | Gamifikasi Cabaran | sama | 404 | ❌ | masih | | probe |
| 31 | Kedai Hadiah | `/admin/hadiah` | sama | `/admin/hadiah` 404 | ❌ | masih | | probe |
| 32 | Marketplace | Produk, Penjual | sama | `/admin/marketplace/products` (10 produk) dan `/sellers` (1 penjual) dalam menu | ✅ | **baru ada** | tulis tidak dijalankan | probe |
| 33 | Papan Pendahulu | Gamifikasi Pelajar | sama | 404 | ❌ | masih | | probe |
| 34 | Pencapaian | tidak disahkan | tidak disahkan | tiada | ❌ | masih | pengurusan admin tidak dikenal pasti di V1/V2 | - |
| 35 | Kotak Misteri | Kawalan Reward | sama | `/admin/reward-control` 404 | ❌ | masih | | probe |
| 36 | Rujuk Kawan | Gamifikasi tetapan | sama | tiada | ❌ | masih | | probe |
| 37 | Cikgu Alesa | Chatbot | Chatbot | `/admin/chatbot` 404 (AI disembunyi D73) | ❌ | masih (disengajakan) | | probe |
| 38 | Kedai Hadiah Digital | Hadiah | sama | sama #31 | ❌ | masih | | probe |
| 39 | Timeline Saya | - | - | - | n/a | masih | - | - |
| 40 | Jemput Ibu Bapa | Pengguna | `parent-links` | `/admin/parent-links` 404 | ❌ | masih | | probe |
| 41 | Pelajar Saya | Pengguna, Import | sama | `/admin/users` (38 pelajar, 10 guru, penapis peranan/sekolah), Import Pelajar (menu), Import Pengguna `/admin/users/bulk-import` (route, tiada menu) | ✅ | **ditutup** | Import Pengguna tiada menu; tulis tidak dijalankan | probe |
| 42 | Laporan | `/admin/laporan` | sama | 404 | ❌ | masih | | probe |
| 43 | Laporan Mingguan | Laporan | sama | tiada | ❌ | masih | | - |
| 44 | Sumbang Soalan | Senarai Soalan + Kertas Soalan Guru | Import & Semakan + Kiriman Guru | soalan guru dihantar daripada borang guru (kini ada medan Bab, SP, TP, Aras) dan muncul di Kiriman Guru; Baris Gilir Semakan kini redirect ke `/admin/studio?status=review` (satu baris gilir) | ⚠️ | **ditutup sebahagian** | soalan guru tidak dikesan dalam senarai Studio "Menunggu Semakan" semasa diuji (hanya soalan CSV; belum dipastikan) | probe |
| 45 | Sekolah Bersaing | `/sekolah-bersaing` | sama | `/admin/laporan-sekolah/sekolah-bersaing` 404 | ❌ | masih | | probe |
| 46 | Statistik Penggunaan | Analitik | Analitik | `/admin/laporan-sekolah/statistik-penggunaan` tiada | ❌ | masih | | probe |
| 47 | DSKP Heatmap | Kurikulum | Kurikulum | `/admin/laporan-sekolah/dskp-heatmap` 404 | ❌ | masih | | probe |
| 48 | Laporan Aktiviti | Laporan | Laporan | tiada | ❌ | masih | | probe |
| 49 | Amaran Awal | Wellbeing Alerts | sama | `/admin/laporan-sekolah/amaran-awal` 404 | ❌ | masih | | probe |
| 50 | Laporan Bulanan | Laporan | Laporan | tiada | ❌ | masih | | probe |
| 51 | Senarai Pelajar | Pengguna | Pengguna | `/admin/users` | ✅ | masih | | probe |
| 52 | Senarai Guru | Pengguna | Pengguna | `/admin/users` | ✅ | masih | | probe |
| 53 | Kelas Sekolah | Sekolah | Sekolah | `/admin/classes` 404 | ❌ | masih | sama #8 | probe |
| 54 | Laporan Soalan | `/admin/question-reports` | sama + tile | `/admin/question-reports`: 1 laporan "Menunggu", tab Senarai/Kualiti/Laporan/Perlu dikumpulkan semula | ⚠️ | masih | tindakan pada baris tidak dijalankan | probe |

Kod cacat baharu: G-01 rangsangan hilang senyap pada Simpan draf; G-02 Topik tidak ditapis mengikut Bab; G-03 soalan terbit tidak muncul dalam Soalan by Chapter (punca belum pasti); G-04 Jana set "Kolam tidak mencukupi" walaupun kolam tersedia mencukupi secara kiraan; G-05 import CSV gagal tanpa sebab dan tanpa lajur DSKP.

## 3. Aliran F1-F9 (V3-local, dijalankan 8 Nov)

Pembilang (Lulus / Separa / Gagal / Disekat): F1 6/1/0/0 · F2 4/2/1/0 · F3 3/0/0/0 · F4 4/3/0/1 · F5 0/0/1/0 · F6 0/1/0/0 · F7 2/1/0/0 (pemerhatian, bukan dijalankan semula) · F8 3/1/0/0 · F9 3/0/0/1. (4 Nov: F1 6/1, F2 4/2/2/1, F3 2/0/1, F4 5/4, F5 0/0/1, F6 0/0/1, F7 2/1, F8 8/0/0/1, F9 2/0/2.)

| Aliran | Hasil | Keterangan |
|---|---|---|
| F1 Cipta soalan (Studio) dengan DSKP + rajah | **Lulus** (satu cacat G-01) | Cipta soalan Matematik T4 Kertas 1, Bab, unit DSKP (Topik) + SP DSKP 2.1.1, TP 3, aras Memahami; rangsangan kongsi (Rajah 1) dengan gambar dicipta sebagai Kumpulan #3 dan kekal selepas muat semula; Hantar untuk semakan, Terbitkan: "Soalan diterbitkan — kini boleh dijawab oleh pelajar." Indikator "Dilihat murid di 2 daripada 6 aktiviti". Cacat: medan rangsangan yang diisi tetapi belum klik "Cipta rangsangan kongsi" dibuang senyap semasa Simpan draf (G-01). Selain itu Topik tidak ditapis mengikut Bab (G-02). |
| F1b Murid nampak soalan | **Separa** | Murid tidak nampak soalan 1292 di Soalan by Chapter (Matematik T4: hanya Bab 1, 10 soalan). Punca tidak disahkan: soalan ini bertag Bab 7 dengan unit 2.0 dan ada kertas (Kertas 1). Soalan hanya "dilihat di 2 daripada 6". |
| F2 Import CSV | **Lulus + Separa** | 2 soalan masuk sebagai draf dengan subjek/tahap lalai; kolum kertas dibawa. Separa: CSV tiada kolum unit/SP/TP/aras (lajur DSKP); import dengan `subject_id=3` gagal tanpa sebab ("0 diimport, 2 gagal"; halaman Sejarah Import hanya kiraan) (G-05). |
| F2 Import PDF | **Lulus (persekitaran) + Separa** | Muat naik PDF mencipta kelompok 1, status "Selesai" (tidak lagi tersangkut), butang "Ekstrak soalan" berfungsi dalam beberapa saat. Separa: pengekstrak ialah "mock (heuristik-1)": 1 soalan, pilihan A-D tidak dipecahkan, 6 isu; OCR sebenar tidak dapat dinilai. Tab "Kertas Diimport" V2 tiada. |
| F3 Kelulusan / arkib | **Lulus** | Studio: Hantar untuk semakan, Terbitkan, Arkib (dialog "Arkibkan soalan ini?" > Sembunyikan). `/admin/spm/semakan` kini redirect ke `/admin/studio?status=review`: satu baris gilir (4 Nov: dua baris gilir bercanggah, ditutup). Pintu terbit kini menunjuk langkah: "Sila pilih unit DSKP. - Langkah 4", "Sila pilih Bab", "belum ada aras pemikiran - Langkah 3"; kertas tidak lagi diwajibkan untuk soalan bank. |
| F4 Bina dan terbit kertas | **Separa / Disekat sebahagian** | Mula kosong (Matematik Tambahan K2): set #7 dicipta, kontrak "Disahkan" (3472/2) jadi tiada pengecualian; Bahagian A/B/C dengan kuota dan baris "Kurang 7 soalan (perlu 7, ada 0)"; kawalan "Jawab Semua / Pilih N" ada (ditutup); Tambah dari bank berfungsi. Jana set: butang dikunci dengan "Kolam tidak mencukupi" walaupun "62/63 soalan tersedia" (sebab hanya muncul selepas Pratonton kolam: "Bahagian A: perlu 6 markah 489, hanya 2 tersedia") (G-04); tiada Tahun/Negeri. Kertas MAT K1 "Spec": terbit disekat ("belum Disahkan"). Terbitan penuh kertas baharu **tidak dapat diselesaikan**: kolam seed hanya soalan 1 markah (data). Dua pembina (Pembina Kertas dan Set Builder) masih dalam menu. |
| F5 Tracking A | **Gagal** | `/admin/spm/tracking-a` 404; hub 5 kad. |
| F6 Kertas Subjektif | **Separa** | `/admin/kertas-subjektif` kini dibuka (penapis, 0 kertas); membina/menerbit kertas tidak diuji (kosong: data). |
| F7 Kontrak | **Lulus x2 + Separa** | Senarai 8 kontrak, 1 Disahkan (4 Nov: 0), 7 Spec; "Sunting kontrak" dari Set Builder. Tidak dijalankan semula. |
| F8 Murid | **Lulus x3 + Separa** | `pelajar@demo.test` nampak 2 kertas Bijak SPM terbit (1 "Cuba lagi" 3/6, 1 "Belum cuba"). Soalan baharu F1: lihat F1b. Kertas baharu F4 tidak diterbit. Tidak duduki kertas semula. |
| F9 Guru | **Lulus x3 + Disekat** | Borang Sumbang Soalan guru kini ada Bab, SP, TP, Aras; hantar > Kiriman Guru admin (`/admin/question-submissions`, bukan "belum tersedia" lagi). Muat naik kertas PDF oleh guru tidak diuji dalam UI (percubaan API ditolak CSRF; tiada kesimpulan). |

## 4. Menu: kiraan vs sasaran 47 item

- Sidebar Admin Pusat sekarang: **40 pautan, 8 kumpulan** (Pemantauan 4, Bank Soalan 8, Kertas & SPM 11, Kurikulum & Kandungan 7, Pengguna & Sekolah 4, Penglibatan 2, Kewangan 2, Sistem 2).
- Pendua yang PRD 47/30 (3.3) putuskan digabung masih ada dalam sidebar: tiga "Bank Soalan" (Bank Soalan, Bank Soalan (Studio), Bank Soalan SPM), Import & Semakan + Senarai Ekstrak (laluan sama), Muat Naik Kertas, Tulis Soalan Manual, Baris Gilir Semakan (kini redirect), Pembina Kertas + Set Builder, Kontrak Simulasi, Kualiti Soalan dan Laporan Soalan (tab sudah wujud tetapi item menu kekal) = **9-10 item pendua/aksi**. Selepas digabung, unik ~29.
- Target PRD: Soalan 9 item + 38 lain = 47. Item sasaran yang tiada dalam sidebar: Audit Rajah (`/admin/soalan-gambar` wujud, tiada menu), Soalan Berstruktur (wujud, tiada menu), Latih Tubi/Tracking A/Subjektif (item kumpulan SPM), Kiriman Guru, Import Pengguna, Kelas Sekolah, Analitik, Laporan, Laporan Eksekutif, Gamifikasi (5), Kedai Hadiah, Kawalan Reward, Permainan, Notifikasi, Audit Log, Kawalan Ciri dan lain-lain.
- `menu.ts`: 106 ditakrif, 46 dibina, 60 belum (4 Nov: 40/66).

## 5. Responsif (375 / 768 / 1280)

17 skrin x 3 saiz = 51 pengukuran `scrollWidth` vs `innerWidth`: **tiada limpahan mendatar** (command-center, studio, studio cipta, spm hub, set builder + builder, kontrak, ekstrak, users, schools, curriculum, marketplace, kertas subjektif, kiriman guru, tiket, settings, semak kertas). Pada 375px terdapat butang "Buka menu" dan "Cari menu". Tangkapan: `v3-studio-375.png`. Tidak diuji: skrin lain yang tidak disenaraikan.

## 6. Cadangan kemaskini PRD

| Fail / ID | Teks semasa | Cadangan | Bukti |
|---|---|---|---|
| `30-admin-pusat.md` section 3.3 note D115 | senarai laluan sasaran "tidak wujud dalam V3 hari ini": `/admin/source-papers`, `/admin/kertas-subjektif`, `/admin/studio/imports` ... | `/admin/source-papers`, `/admin/kertas-subjektif` (+ alias `/admin/spm/kertas-subjektif`) dan `/admin/studio/imports` (redirect) kini WUJUD; baki tidak wujud: `/admin/classes`, `/admin/analytics`, `/admin/laporan`, `/admin/laporan-eksekutif`, `/admin/feature-toggles` | probe 8 Nov |
| `30-admin-pusat.md` Q-17 / Tracking A | "route 404" | kekal 404; hub kini 5 kad (bukan 2) | `/admin/spm` |
| `30-admin-pusat.md` Q-16 / FR-ADM-Q16 | semua kontrak "Spec" | 1 kontrak Disahkan (Matematik Tambahan K2 3472/2) dalam seed demo | `/admin/spm/kontrak` |
| `30-admin-pusat.md` Q-03 Gap | "three lists, two queues" | satu baris gilir (`/admin/spm/semakan` redirect); item menu "Baris Gilir Semakan" patut dibuang | F3 |
| `45-question-authoring-flow.md` §3.3.2 item 7 (batch end rule) | spinner tanpa penghujung | PDF kini tamat "Selesai" dengan butang "Ekstrak soalan"; pengekstrak seed ialah `mock (heuristik-1)` | F2 PDF |
| `47-v3-duplicates-register.md` (menu) | pendua menu akan digabung | sidebar masih mengandungi 9-10 pendua; tandakan "belum dilaksana" | bahagian 4 |
| Baru, FR-QA tentang rangsangan | tiada | tambah AC: medan rangsangan yang diisi mesti sama ada disimpan atau amaran sebelum Simpan draf (G-01) | F1 |

## 7. Jurang teratas (disusun kesan pada "admin menjalankan portal murid")

1. **Gamifikasi (Overview, Tier, Cabaran, Pelajar, Transaksi), Kedai Hadiah, Kawalan Reward, Cabutan, Permainan, Tournament (#21-23, 28-31, 33, 35, 36, 38).** Semua 404; BE sedia, tiada skrin. Murid nampak modul ini; admin tidak boleh urus. Masih sama seperti 4 Nov.
2. **Kawalan Ciri (`/admin/feature-toggles`) tiada.** Tiada cara matikan/hidupkan Latih Tubi, permainan dan lorong tanpa pembinaan semula.
3. **Analitik, Laporan, Laporan Eksekutif, Dashboard dan pandangan pusat sekolah (#2-5, 42, 43, 45-50).** Semua 404; `/admin` hanya redirect.
4. **Tracking A tiada (#13).** Set Tracking A tidak boleh disunting; hub 5 daripada 6 lorong.
5. **Jana set terkunci dengan mesej mengelirukan (G-04).** "62/63 tersedia" tetapi "Kolam tidak mencukupi"; punca hanya selepas Pratonton; tiada Tahun/Negeri. Terbitan penuh kertas baharu tidak dapat diselesaikan dengan data demo (kolam 1 markah sahaja).
6. **Import CSV tanpa lajur DSKP dan tanpa sebab kegagalan (G-05).** Soalan CSV mesti disunting satu persatu (unit, SP, Bab, aras) sebelum terbit; ID mentah (`subject_id`) gagal senyap.
7. **Rangsangan/rajah hilang senyap pada Simpan draf (G-01) dan Topik tidak ditapis mengikut Bab (G-02).** Boleh simpan Bab 7 dengan unit 2.0; soalan terbit tetapi tidak muncul dalam Soalan by Chapter (G-03, punca belum disahkan).
8. **Menu pendua belum digabung (9-10 item) dan menu tidak memaparkan Soalan Berstruktur, Audit Rajah, Kiriman Guru, Import Pengguna, Latih Tubi (lorong hanya dari hub).**
9. **Pengekstrak PDF ialah mock (`heuristik-1`)**: pilihan tidak dipecah; kualiti ekstraksi sebenar tidak dapat dinilai; tab "Kertas Diimport" V2 tiada.
10. **Penajaan/Anak Angkat/Duta, Notifikasi, Audit Log, Bayaran/Billing/Dunning, Chatbot, Kelas Sekolah, Ibu Bapa (#8, 15, 37, 40, 53).** Semua 404.

Cacat kecil: "Kualiti Soalan" purata 0.0 sehingga audit dijalankan; kad "Sekolah Berdaftar" 0 padahal 4 sekolah (langganan 0, data).

## 8. Tidak dapat disahkan

- **V1 dan V2 live: tiada satu halaman pun dilayari** (lihat bahagian 0). Tiada pengesahan visual untuk 87 / 90 menu, "Disahkan" pada kontrak V2, atau salinan BM tepat V2 hari ini. Pengiraan V1/V2 menggunakan kod rujukan V2 dan tangkapan 4 Nov.
- Pelayan produksi V2: tiada agregat data diambil.
- Tulis/CRUD pada Video, Marketplace, Banner, Artikel, Nota, PKSK, Soalan Berstruktur (rubrik), Kertas Subjektif, Tiket, Tetapan: hanya skrin dibuka.
- Eksport CSV/PDF (Monitoring, Kirkpatrick), tindakan baris Laporan Soalan.
- Muat naik kertas PDF oleh guru, duduki kertas Bijak SPM selepas terbit, terbit kertas baharu hingga ke murid (data demo tidak cukup).
- Punca soalan 1292 tidak muncul dalam Soalan by Chapter.
- Pengekstrakan OCR sebenar.
- Bukti: `D:\Dev Projects\prestasiplus-v3\.evidence\gap-2026-11-08\admin\` (6 tangkapan).
