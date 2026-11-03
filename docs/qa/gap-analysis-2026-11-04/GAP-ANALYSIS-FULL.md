# Laporan Analisis Jurang — PrestasiPlus V3 lawan V1 & V2

**Rujukan skop:** `docs/Matriks-Akses-Peranan .xlsx` (lajur Murid / Guru / Admin Sekolah, dan lajur **1.0**)
**Tarikh:** 3–4 November 2026
**Sistem dinilai:**
| Kod | Sistem | Keterangan |
|---|---|---|
| V1 | prestasiplus.my | Sistem asal. Sumber matriks akses. |
| V2 | prestasiplus.cloud + Panel admin.prestasiplus.cloud | Rujukan utama fungsi. |
| V3-GH | Branch `feature/v3-bijak-r1` (GitHub), dijalankan di PC (port 5193) | Kod terkini selepas kerja sesi cloud. Data demo kecil. |
| V3-UAT | uat.prestasiplus.cloud | Pelayan UAT. Data V2 dipindah (±339k soalan). Binaan frontend berbeza daripada V3-GH. |

Butiran sokongan: [MURID.md](MURID.md) · [GURU-ADMIN-SEKOLAH.md](GURU-ADMIN-SEKOLAH.md) · [ADMIN-PUSAT.md](ADMIN-PUSAT.md) · [MATRIX-EVIDENCE.md](MATRIX-EVIDENCE.md) (sel demi sel dengan nama screenshot).

---

## 0. Ringkasan Eksekutif

### Kesimpulan
**V3 belum menepati keperluan 1.0, di portal murid mahupun portal admin.** Rangka menu dan banyak skrin sudah wujud, tetapi:
1. **Portal murid:** 4 daripada 17 modul 1.0 hilang atau tersalah halaman. Modul pembelajaran yang bergantung pada bab/topik DSKP kosong di UAT, dan **Bijak SPM tiada kertas langsung di UAT**.
2. **Portal admin pusat:** tidak dapat menjalankan portal murid sepenuhnya. Aliran soalan berganda dan sebahagiannya rosak. Admin **tiada skrin** untuk ±32 daripada 54 modul matriks, termasuk gamifikasi, hadiah, permainan dan Kawalan Ciri. Di UAT: **0 kontrak, 0 kertas.**
3. **Portal guru:** hampir menepati (16/18). Dua kegagalan: **Laporan Mingguan (Akses Ditolak)** dan **Analitik Adaptif (laluan salah)**.
4. **Portal admin sekolah:** semua 17 menu 1.0 ada di V3-GH. Masalahnya fungsi dan data: Kirkpatrick terhad (403), Analitik kosong, Headcount kosong, Sekolah Bersaing kosong, dan angka bercanggah antara skrin. **Belum diuji di UAT** kerana tiada akaun.

### Papan markah 1.0 (menu ada dan halaman terbuka; fungsi dinilai berasingan)

| Portal | Baris 1.0 | V3-GH ✅ / ⚠️ / ❌ | V3-UAT ✅ / ⚠️ / ❌ | Status fungsi |
|---|:-:|:-:|:-:|---|
| Murid | 17 | 13 / 1 / 3 | 12 / 1 / 4 | 🔴 Tidak menepati |
| Guru | 18 | 16 / 1 / 1 | 16 / 1 / 1 | 🟠 Hampir |
| Admin Sekolah | 17 | 15 / 2 / 0 | belum diuji | 🟠 Menu ada, fungsi/data lemah |
| Admin Pusat (urus portal) | 54 modul | 8 penuh / 10 separa / 32 tiada skrin | sama + data kosong | 🔴 Tidak menepati |

### 10 masalah utama

| # | Masalah | Portal | GH | UAT |
|---|---|---|:-:|:-:|
| 1 | **Bijak SPM tiada kertas.** UAT: 0 kontrak, 0 kertas, jadi murid nampak "Tiada kertas tersedia" (V2: 69 set). | Murid + Admin | ⚠️ | ❌ |
| 2 | **Soalan tidak dipetakan ke bab/topik DSKP di UAT.** Soalan by Chapter "Tiada subjek bab", Topik kosong, Peta Belajar 0/0. | Murid + Admin | ⚠️ | ❌ |
| 3 | **Prestasi murid membuka "Dashboard Sekolah"**, iaitu data seluruh sekolah (kebocoran data), bukan Prestasi 360 diri sendiri. | Murid | ❌ | ❌ |
| 4 | **Murid tiada Headcount, Analisa Item, Laporan Soalan** (semua 1.0, semua ada di V2). | Murid | ❌ | ❌ |
| 5 | **Guru Laporan Mingguan "Akses Ditolak"**: menu menunjuk laluan salah, dan skrin sebenar "belum tersedia". | Guru | ❌ | ❌ |
| 6 | **Aliran import soalan rosak**: ekstrak PDF tersangkut, CSV/manual tak boleh terbit, Kiriman Guru 503. | Admin | ❌ | ? |
| 7 | **Menu soalan admin berganda**: 3× "Bank Soalan", 2 pembina kertas, 2 baris gilir semakan. Hub SPM 2/6 lorong. | Admin | ❌ | ❌ |
| 8 | **Admin tiada skrin** untuk Gamifikasi, Kedai Hadiah, Marketplace, Permainan/Cabutan/Tournament, Kawalan Ciri, Kertas Subjektif, Tracking A. | Admin | ❌ | ❌ |
| 9 | **Latihan hanya T4–T5.** Murid T1–T3 nampak "akan datang" (V2 buka semua tingkatan). **UAT masih ada 11 tahap** (Darjah aktif). | Murid | ⚠️ | ❌ |
| 10 | **Admin Sekolah**: Kirkpatrick Tahap 1–4 403, Analitik kosong, Headcount kosong, angka bercanggah antara skrin. | Admin Sekolah | ❌ | belum diuji |
| 11 | **Struktur soalan rosak (D90)**: di V1/V2 rajah dijadikan "soalan" dan soalan berkaitan terpisah. Di UAT, soalan "Rajah 14 …" **diterbitkan tanpa rajah** dengan teks berulang, dan disajikan kepada murid. Lihat §5A. | Admin + Murid | ⚠️ (kod ada, belum disahkan) | ❌ |
| 12 | **Kaedah tambah soalan tidak ikut DSKP**: medan DSKP hanya disemak lewat semasa terbit, CSV tanpa medan DSKP, struktur kertas hilang semasa muat naik, pokok DSKP UAT 0 nod. | Admin | ❌ | ❌ |
| 13 | **Skrin kertas soalan tidak responsif sepenuhnya**: tiada "Hantar" di telefon, matriks ditulis sebagai ayat. | Murid | ❌ | ❌ |

---

## 1. Skop, sumber dan kaedah

### 1.1 Akses yang digunakan
| Sistem | Peranan | Cara | Liputan |
|---|---|---|---|
| V1 | Admin | Log masuk langsung | Sidebar 87 menu. Murid/guru/admin sekolah V1: tiada akaun, jadi lajur V1 = tanda dalam matriks (dibina daripada sidebar V1 asal) + dokumen penemuan V1 dalam repo. |
| V2 | Murid ×2, Guru ×2, Admin Sekolah, Admin | Log masuk langsung (baca sahaja) | Murid 78/78 menu + murid kedua (akaun berdata) 17 modul · Guru 61/61 · Admin Sekolah 39/80 (IP disekat di tengah) · Admin sidebar 90 + Panel 6 · kod V2 (`prestasiplus-reference`) |
| V3-GH | Semua peranan (akaun demo) | Log masuk langsung | Semua menu + ujian fungsi admin → murid (F1–F9) |
| V3-UAT | Murid T1 (smoke), **Murid T5 (dicipta 2026-11-03)**, Guru, Admin | Log masuk langsung | 95/95 halaman + ujian murid T5. **Tiada akaun Admin Sekolah.** |

### 1.2 Tanda pengesahan
👁 dilihat sendiri (screenshot disemak) · 🤖 sapuan automatik (halaman dibuka, tajuk/API direkod) · 🧪 diuji fungsi (klik/aliran) · 📄 kod/dokumen sahaja.

### 1.3 Had
- Data V3-GH ialah **demo kecil**, jadi jurang kandungan di GH tidak semestinya jurang fungsi. UAT memakai data V2 dan menjadi ujian data sebenar.
- Admin sekolah V2 tiada portal sendiri: ia memakai panel admin pusat berskop sekolah (📄 kod V2). Modul admin sekolah dalam matriks (Senarai Pelajar/Guru, Kelas Sekolah, Laporan Bulanan, DSKP Heatmap, Statistik Penggunaan) **tiada di V2**, jadi rujukannya **V1**.
- V2 juga ada kelemahan sendiri. Contoh: Soalan by Chapter V2 memaparkan "0 soalan chapter" bagi murid yang dilihat 👁, dan Latih Tubi V2 ditutup (flag OFF).

---

## 2. Portal Murid

### 2.1 Ringkasan
- **Menepati:** Analitik Adaptif, Video, Kelas Saya, Heatmap Topik Lemah, Permainan, Latih Tubi (T4–T5), Panduan, Log Keluar.
- **Separa:** Dashboard, Profil Saya, Tetapan, Remedial, Soalan by Chapter, SPM/Bijak SPM.
- **Hilang atau salah:** Headcount, Prestasi, Analisa Item, Laporan Soalan.
- **Di UAT tambahan:** Bijak SPM 0 kertas, Soalan by Chapter/Topik/Peta Belajar kosong, latihan T1–T3 tiada.

### 2.2 Modul 1.0 — butiran

| # | Modul | Fungsi di V2 (rujukan) | V3-GH | V3-UAT | Jurang fungsi | Punca (V3) | Teruk |
|---|---|---|---|---|---|---|---|
| 2 | **Dashboard** | Salam; kad **Pakej SPM Aktif**; kad **Kombo** (amaran putus); 5 kiraan; Misi Harian 1/3; **check-in mood**; **Cabaran Kilat**; Artikel Untuk Kamu; Subjek Tersedia; **Soalan Terkini** 👁 | Ada: kiraan, Misi 0/10, pintasan, Artikel, Subjek; tambah banner, Percubaan Percuma, rakan belajar 👁 | Sama 🤖 | Tiada Pakej SPM Aktif, Kombo, mood, Cabaran Kilat, Soalan Terkini | Tiada FE/BE mood (parity C01); `/kombo` luar skop | Sed |
| 3 | **Headcount** | Halaman "Headcount — Tracking prestasi murid (TOV, OTR, AR, RS)"; kosong "Guru anda belum menyediakan headcount" 👁 | **Tiada menu; `/headcount` = 403** 🤖 | **Tiada menu** 🤖 | Modul 1.0 hilang | `user-nav.ts` `STUDENT_HIDDEN_IDS`; peranan `routes/headcount.ts` | **Tinggi** |
| 4 | **Prestasi** | **"Prestasi Saya — Prestasi 360 Dashboard Individu"**: ketepatan, hari kombo, sesi, soalan dijawab, masa belajar, Headcount SPM, trend, peta aktiviti 90 hari, cadangan, penguasaan subjek 👁 | **Dialih ke "Dashboard Sekolah"**: 6 kelas, 17 murid, 4 guru, GPS sekolah, Prestasi Guru 👁 | **Sama: Dashboard Sekolah** ("1 kelas · 2 murid … 1 Guru") 👁 | Murid melihat data seluruh sekolah (**kebocoran data**); tiada Prestasi 360 | `m08 routes/prestasi.ts:29` redirect; `student` dalam `PRESTASI_SCHOOL_ROLES`; `/prestasi/:userId` wujud tapi tak dipakai | **Kritikal** |
| 5 | Analitik Adaptif | Tab 14 subjek, penguasaan SP DSKP 👁 | Ada (subjek berdata sahaja) 👁 | Ada 🤖 | Pemilih subjek hanya subjek berdata | — | Rendah |
| 6 | **Analisa Item** | Halaman peribadi: Soalan Dijawab, Perlu Pemulihan, Perlu Pengukuhan, Tahap Penguasaan 👁 | **Tiada menu**; `/analisa-item` dialih ke Dashboard 🤖 | **Tiada menu** 🤖 | Modul 1.0 hilang | `analisa-item.ts:43` `analisaItemTarget` tiada sasaran murid | **Tinggi** |
| 7 | Video | Tab kategori + senarai 👁 | Sama 👁 | Sama 🤖 | — | — | — |
| 8 | Kelas Saya | "Belum dimasukkan ke kelas" 👁 | Sertai kod kelas + senarai 👁 | Sama 🤖 | — (V3 lebih) | — | — |
| 9 | **Soalan by Chapter** | 15 subjek dengan bilangan bab (BM 26 … Fizik 97); peraturan bab seterusnya dibuka pada **70%** 👁. (V2 sendiri: "0 soalan chapter" bagi murid dilihat.) | 1 subjek; peraturan 70% tidak dinyatakan 👁 | **T5: "Tiada subjek bab tersedia untuk tahap ini"**; T1: "akan datang" 👁 | Soalan tiada bab DSKP; peraturan 70% tiada | `curriculum_nodes` kosong + jambatan MCQ ke bab (parity C08); data UAT tiada pemetaan bab | **Tinggi** |
| 12 | Remedial | Kad pemulihan **auto** daripada subjek lemah (cth. Sains 0%, sasaran 60%) 👁 | "Tiada ujian remedial" (hanya yang ditugaskan) 👁 | Sama 🤖 | Tiada jana pemulihan auto | Hanya `remedial-tests/mine` | Sed |
| 13 | **SPM / Bijak SPM** | Hub: Databank **408,197** soalan, Tracking A 1,744, Subjektif **4,061** set, Bijak SPM **69** set. Simulasi: BI 11 set, Geografi 10, Perniagaan 10 … 👁 | Hub: Databank 492, Tracking A 370, Subjektif 3; Bijak 1–2 kertas 👁 | **Bijak SPM: "Tiada kertas tersedia buat masa ini"** 👁 | UAT: tiada kertas. GH: tiada swa-markah subjektif, 8/14 widget jawapan, 3/15 jenis stimulus 📄 | UAT: 0 kontrak & 0 kertas (§5.3). Komponen `PartInput.vue`, `StimulusView.vue`, tiada endpoint swa-markah | **Kritikal** |
| 14 | Heatmap Topik Lemah | Legenda 4 warna, keadaan kosong 👁 | Sama 👁 | Sama 🤖 | — | — | — |
| 16 | Latih Tubi | (V2: ditutup, flag OFF; latihan melalui Soalan by Chapter) | Subjek → tahap → kesukaran → bilangan → kuiz → semak jawapan 🧪 | **T5: berfungsi** — Matematik 1,018, Sains 2,551, Sejarah 904, BI 805, BM 411 soalan + tahap kesukaran 🧪👁. **T1: "akan datang"** 👁 | T1–T3 tiada latihan | Peraturan V3: kandungan T4–T5 sahaja (D72) | Sed |
| 21 | Permainan | Battle: ranking, Quick Match, Cabar Kawan 👁 | Zon Permainan (lebih banyak permainan) 👁 | Sama 🤖 | — (V3 lebih) | — | — |
| 54 | **Laporan Soalan** | **"Laporan Soalan Saya"**: Jumlah / Menunggu / Disemak / Diperbaiki / Ditolak 👁 | **Tiada menu**; `/laporan-soalan` dialih ke Dashboard. Butang "Lapor Soalan" dalam kuiz ada 🤖 | **Tiada menu** 🤖 | Murid boleh lapor tetapi tak boleh jejak status | `my-reports.ts` wujud tetapi disekat `prototype-scope.ts` (D43) | **Tinggi** |
| A1 | Profil Saya | Profil awam + pautan kongsi, statistik, Bio + Cita-Cita, lencana, kalendar kombo 30 hari, sesi terkini 👁 | Nama, e-mel, ahli sejak, "Kemaskini Profil" sahaja 👁 | Sama 👁 | Tiada profil awam, bio, statistik, lencana, kalendar, sesi | Halaman `/profile` ringkas | Tinggi |
| A2 | Tetapan Peribadi | "Tetapan Akaun": e-mel, telefon, sekolah, peranan, status 👁 | "Mod Rohani" sahaja; maklumat akaun tiada 👁 | Sama 🤖 | Kandungan berbeza | Spec V3 | Sed |
| A3 | Panduan | Panduan ikut peranan 👁 | Sama 👁 | Sama; API `/api/config/support` **404** 🤖 | Ralat API di UAT | — | Rendah |

### 2.3 Modul murid luar 1.0 (17–40)
Hampir semua ada di V2 dan V3 🤖. Perbezaan fungsi utama:
| Modul | Jurang |
|---|---|
| Kedudukan | V2: kad kedudukan sendiri (#406/864) + "sekitar anda". V3: tiada, senarai kosong. |
| Kedai Hadiah / Hadiah Digital | V2: katalog (token, stok). V3: kosong. |
| Kotak Misteri, Rujuk Kawan, Timeline | Model ganjaran berbeza daripada V2. |
| Papan Pendahulu | Tiada penapis tempoh/skop & kedudukan sendiri. |
| Mohon Keluarga Angkat, Cikgu Alesa | Disembunyi di V3 (D74, D73). |
| Topik, Peta Belajar | **UAT kosong** ("Tiada topik", 0/0) 👁. |

---

## 3. Portal Guru

### 3.1 Ringkasan
16 daripada 18 modul 1.0 menepati. Dua kegagalan menu (laluan salah). V2 guru ada 61 menu; menu di luar matriks (Kehadiran Digital, Broadcast, Databank, Penjana Peperiksaan, dll.) tidak dikira jurang 1.0.

### 3.2 Modul 1.0 — butiran

| # | Modul | Fungsi di V2 | V3-GH | V3-UAT | Jurang | Punca | Teruk |
|---|---|---|---|---|---|---|---|
| 43 | **Laporan Mingguan** | `/guru/laporan-mingguan-kelas`: pilih kelas, Cetak, Soalan Dijawab, Pelajar Aktif, Pelajar Meningkat, Subjek Perlu Perhatian, Pelajar Terbaik 🤖📄 | **"Akses Ditolak"** (`/laporan-mingguan`) 🤖 | **"Akses Ditolak"** 🤖 | Modul mati sepenuhnya | `user-nav.ts:287` laluan salah; `prestasi.ts:95-101` `roles: []`; skrin M11 sebenar hanya "belum tersedia dalam prototaip" | **Kritikal** |
| 5 | **Analitik Adaptif** | **"Analitik Kelas"** `/analitik/kelas` 🤖 | Buka `/analitik/pelajar` (paparan murid, kosong) 🤖 | Sama 🤖 | Guru tak sampai ke analitik kelas | `user-nav.ts:284` sasaran salah; `/analitik/kelas` wujud tetapi tak dipaut | **Tinggi** |
| A1 | Profil Saya | `/guru/profil/edit`: Bio, Subjek Utama, Kelayakan, Pengalaman, No KP, profil awam 🤖 | Profil generik 🤖 | Sama 🤖 | Medan profesional guru tiada | `/guru/profil/edit` tiada route (copy.ts:91 rujuk laluan mati) | Sed |
| 6 | Analisa Item | Ada 🤖 | Ada; data kosong 🤖 | Ada 🤖 | Data | Seed | Rendah |
| 9 | Soalan by Chapter | Ada 🤖 | 1 subjek 🤖 | Ada 🤖 | Data | Seed | Sed |
| 1,2,3,4,7,8,10,11,41,42,44 | Command Center, Dashboard, Headcount, Prestasi, Video, Kelas Saya, Monitoring, Kirkpatrick (7 skrin), Pelajar Saya, Laporan, Sumbang Soalan | Ada 🤖 | Ada 🤖 | Ada 🤖 | — | — | — |

---

## 4. Portal Admin Sekolah

### 4.1 Ringkasan
Semua 17 menu 1.0 ada di V3-GH 🤖. Rujukan ialah **V1**, kerana V2 tiada portal admin sekolah 📄. Masalah utama ialah fungsi terhad dan data tidak konsisten. **UAT belum diuji** kerana tiada akaun admin sekolah; borang penciptaan sudah disediakan dan menunggu pengguna menekan "Janakan Akaun".

### 4.2 Modul 1.0 — butiran (V3-GH)

| # | Modul | Rujukan V1 | V3-GH | Jurang | Punca | Teruk |
|---|---|---|---|---|---|---|
| 11 | **Kirkpatrick** | 7 skrin | Ringkasan sahaja 👁. Klik "Tahap 1: Reaksi" di bawah "Klik mana-mana tahap untuk lihat detail" → **tiada apa berlaku (butang mati)** 👁. `/admin-sekolah/kirkpatrick/reaction` → **404 "Halaman Tidak Dijumpai"** 👁. Penapis memaparkan **"Semua Sekolah / Semua Negeri"** kepada admin sekolah 👁 | 6 sub-skrin tiada; butang mati; skop penapis salah | `m12 routes/mount.ts:33` "S1 only"; `overview.ts:39` `detailLinks:false` | **Tinggi** |
| 5 | **Analitik Adaptif** | Analitik | Buka paparan murid kosong; `/analitik/kelas` tak dibenarkan untuk `school_admin` 📄 | Tiada analitik langsung | `user-nav.ts:398`; `routes/class.ts:33` | **Tinggi** |
| 3 | **Headcount** | Senarai + dashboard | "Belum ada headcount.", sedangkan Dashboard kira 10 entri 👁 | Senarai kosong | Skop senarai ikut guru pencipta (`m08 headcount.ts:47-60`, belum disahkan) | **Tinggi** |
| 45 | **Sekolah Bersaing** | Papan 20 sekolah | "Data minggu ini belum dijana. Cron mingguan akan kira pada Isnin pagi. Tunggu kejap ya." 👁 | Kosong | Seed `SB_WEEKS` tiada minggu semasa, tiada fallback | **Tinggi** |
| 49 | Amaran Awal | Taburan risiko, senarai berisiko | 17/17 "Berisiko Tinggi" kerana tiada data 📄 | **Amaran palsu** | Peraturan skor: tiada data = risiko tertinggi | Sed |
| 46 | Statistik Penggunaan | (analog PPD) | 0 sesi dalam 30 hari, sedangkan Dashboard 15 sesi 📄 | Data bertentangan | Seed bertarikh tetap | Sed |
| 47 | DSKP Heatmap | — | Semua sel "–" 📄 | Tiada data penguasaan | Seed | Sed |
| 50 | Laporan Bulanan | — | 4 kad sahaja, bulan semasa kosong 📄 | Nipis | `SubjectPerformance.vue` tak terpapar bila tiada data | Sed |
| 51 | Senarai Pelajar | Jadual + import pukal | Ada; **tiada Import Pelajar pukal**, tiada penapis kelas 📄 | Separa | Import disorok skop | Sed |
| 1 | Command Center | Skop sekolah | Ada; kad platform "0 Sekolah Berdaftar" tersilap muncul 📄 | Kad salah | Kad dikongsi dengan admin pusat | Sed |
| — | **Ketekalan data** | — | Pelajar 17/16/13, guru 3/4, soalan 122/30/36, ketepatan 57.9/73.3/33.3% di skrin berlainan 📄 | Angka bercanggah | Model bacaan M27/M08/M11/M12 berbeza | Sed |
| 4,6,7,10,48,52,53 | Prestasi, Analisa Item, Video, Monitoring, Laporan Aktiviti, Senarai Guru, Kelas Sekolah | Ada | Ada 🤖 | — / kecil | — | Rendah |

---

## 5. Portal Admin Pusat — boleh urus portal murid?

### 5.1 Peta: modul murid 1.0 → skrin admin yang mengisinya

| Murid nampak | Admin V2 mengisi melalui | Admin V3 | Jurang | Teruk |
|---|---|---|---|---|
| SPM / **Bijak SPM** | Import & Semakan → Studio → **Set Builder** → Terbit; Kontrak (dari builder); hub 6 lorong | Ada tetapi **berganda** (Pembina Kertas + Set Builder; 3 bank soalan; 2 baris gilir); hub 2/6; Tracking A, Kertas Subjektif tiada | Berganda + separa | **Kritikal** |
| Soalan by Chapter, Latih Tubi, Topik, Peta Belajar | Studio + Kurikulum (pemetaan bab/SP) | Studio + Kurikulum ada | UAT: soalan **tiada bab/SP** (339k "Belum ditanda DSKP") | **Kritikal** |
| Laporan Soalan | Laporan Soalan | BS-05 ada | Tindakan dari baris belum disahkan | Rendah |
| Video | Filament videos | **Tiada skrin Pentadbiran** (BE ada) | Tiada | Tinggi |
| Permainan | Tetapan Permainan | **Tiada skrin** (BE ada) | Tiada | Tinggi |
| Headcount, Prestasi, Analisa Item | Dashboard / Analitik / Kualiti | Analitik & Dashboard pusat **kosong**; Kualiti ada | Separa | Tinggi |
| Remedial, Heatmap | (tiada skrin khusus di V2) | — | — | — |

### 5.2 Ujian fungsi aliran soalan (V3-GH) 🧪

| Aliran | Hasil | Butiran |
|---|---|---|
| F1 Cipta soalan di Studio → semak → terbit → murid | **Lulus (separa)** | Terbit mula-mula ditolak (422: perlu SP DSKP, aras pemikiran, kertas). Selepas dilengkapkan, soalan muncul di Latih Tubi & Soalan by Chapter murid. Bar "5 belum lengkap" tidak sebut apa yang kurang. |
| F2 Import kertas | **Gagal** | PDF dimuat naik tetapi ekstrak **tersangkut "Sedang diproses"** selamanya (`JOBS_WORKER_ENABLED=false`, `OCR_ENGINE=none`). Tulis Manual & CSV berfungsi, tetapi soalannya **tak boleh terbit** tanpa SP/aras/kertas; CSV tiada lajur untuk medan itu; kertas yang dipilih semasa muat naik tidak dibawa ke soalan. |
| F3 Lulus / arkib | **Separa** | Lulus & arkib berfungsi, tetapi **2 baris gilir tidak sepadan** (Studio "Menunggu" 3, Baris Gilir Semakan 0). |
| F4 Bina & terbit kertas | **Separa** | Set Builder & Pembina Kertas berfungsi tetapi **senarai kertas sama** (bertindih). Jana set tiada Tahun/Negeri/bilangan bebas; tiada kawalan "Jawab Semua / Pilih N". Semua 8 kontrak "Spec", jadi **setiap terbit perlu pengecualian**. |
| F5 Tracking A | **Gagal** | `/admin/spm/tracking-a` = 404. |
| F6 Kertas Subjektif | **Gagal** | 404. Murid tak dapat swa-markah subjektif. |
| F7 Kontrak Simulasi | **Separa** | Senarai & editor ada; status "Disahkan" tak boleh dipilih di UI. |
| F8 Murid duduki kertas | **Lulus** | Kertas terbit muncul di Bijak SPM, boleh diduduki, dimarkah betul, Cuba Lagi berfungsi. |
| F9 Guru hantar soalan | **Separa** | Satu soalan: berjaya (masuk Studio). **Hantar kertas PDF: 503**. Admin "Kiriman Guru": "belum tersedia dalam demo". |

### 5.3 Keadaan admin di UAT 👁

| Skrin | Tertera | Kesan |
|---|---|---|
| Studio | **339,112** soalan "Diterbitkan"; setiap baris "Dilihat murid di 0/6", **"Belum ditanda DSKP"** | Soalan sampai ke Latih Tubi (T5 disahkan), tetapi **tiada bab/topik**. Penunjuk "0/6" mengelirukan. |
| Pembina Kertas | **0 kertas** | Bijak SPM murid kosong |
| Kontrak Simulasi | **0 kontrak** | Kertas tak boleh diterbitkan langsung |
| Statistik awam | 24,163 soalan, **11 tahap** | Darjah masih aktif; tidak ikut "sekolah menengah sahaja" |

### 5.4 Struktur menu soalan (V3-GH dan UAT sama) 🤖

| Masalah | Butiran |
|---|---|
| 3 menu "Bank Soalan" | `/admin/questions` (bank lama V2), `/admin/studio` (bank rasmi V2), `/admin/spm/soalan` (ciptaan V3) |
| Menu pendua | "Import & Semakan" dan "Senarai Ekstrak" → URL sama |
| 2 pembina kertas | Pembina Kertas + Set Builder → kertas sama |
| 2 baris gilir semakan | Studio "Menunggu Semakan" + "Baris Gilir Semakan" → kiraan berbeza |
| Hub SPM | 2 kad (V2: 6) |
| Tiada di V3 | Sumber Kertas, Kertas Subjektif, Tracking A, Soalan Berstruktur (tiada menu), Kiriman Guru (tiada menu, BE tiada) |

### 5.5 Skrin admin yang tiada (backend sudah ada untuk kebanyakannya) 📄

| Kawasan | Menu V2 | V3 |
|---|---|---|
| Gamifikasi | Overview, Tier Config, Cabaran, Pelajar, Transaksi | ❌ tiada skrin (API `admin/gamification` ada) |
| Ganjaran | Kedai Hadiah, Kawalan Reward | ❌ tiada skrin (API `shop/admin` ada) — tebusan murid tak boleh disempurnakan |
| Marketplace | Produk, Penjual | ❌ tiada (BE baca sahaja) |
| Permainan | Tetapan Permainan, Battle, Tournament | ❌ tiada skrin (API `admin/games` ada) |
| Kawalan Ciri | ±25 togol | ❌ tiada model/endpoint |
| Laporan pusat | Dashboard, Analitik, Laporan, Laporan Eksekutif | ❌ route kosong (M17) |
| Lain | Penajaan/Anak Angkat, Notifikasi, Pembayaran/Billing, Tetapan, Audit Log, Chatbot | ❌ tiada |

---

## 5A. Isu struktur soalan dan DSKP

### 5A.1 Masalah teras: rajah dijadikan "soalan", soalan berkaitan terpisah (V1 & V2)
Di V1 dan V2, **rajah, petikan atau jadual dijadikan satu "soalan" sendiri**, dan soalan-soalan yang merujuknya **dipisahkan menjadi soalan berasingan**. Dalam kertas sebenar, **satu rajah ialah rujukan bersama untuk 1 atau lebih soalan**. Ini keputusan pengguna **D90** dan **D41**. Kod V2 mengesahkannya (`docs/requirements/v2-question-bank-oldsystem-findings.md` §A) 📄:

| Bukti dalam kod V2 | Kesan |
|---|---|
| Tiada entiti "kumpulan rajah"; `PaperSection::sharedStimulus()` hanya menyemat rajah yang dikongsi oleh **seluruh** bahagian | Julat seperti "Rajah 3 → soalan 5–8" tidak boleh diwakili |
| Import DOCX (`DocxSetParser`) mengaitkan rajah dengan **soalan pertama sahaja**; `DocxSetImporter` cipta rajah baharu untuk setiap soalan | Rajah diduplikasi; soalan 2, 3 … kehilangan rajah |
| Penjana set rawak (`RandomSetGenerator`, `PickableQuestionPool`) dan Latih Tubi memilih soalan satu-satu | Kumpulan terpecah; soalan muncul **tanpa rajahnya** |
| ±14% soalan lama berbunyi "Rajah 3 menunjukkan…" tetapi **tiada rajah** | Soalan tidak boleh dijawab |
| Rajah tidak melekat (sticky) di telefon | Murid kehilangan rajah semasa menjawab |

### 5A.2 Bukti langsung di V3-UAT 👁 (browser kelihatan, 2026-11-04)
| Soalan (Studio UAT) | Status | Masalah |
|---|---|---|
| "Rajah 14 menunjukkan dua tin yang sama saiz berayun…" (Sains T4, id 812791) | **Diterbitkan** | **Tiada rajah**; teks soalan **berulang dua kali** (sebagai tajuk dan "(1) …") |
| "Rajah 11 …", "Rajah 9 …", "Rajah 7 …" (Sains T4) | Diterbitkan | Corak sama |
| 339,112 soalan dipindah | Diterbitkan | Semua **"Belum ditanda DSKP"**; disajikan dalam Latih Tubi (murid T5 dapat Sains 2,551 soalan) |

**Maksudnya:** murid UAT sedang diberi soalan yang merujuk rajah yang tidak wujud. Kesilapan struktur V1/V2 terbawa ke V3 melalui pemindahan data.

### 5A.3 Keadaan V3
| Perkara | V3-GH | V3-UAT | Bukti |
|---|---|---|---|
| Model kumpulan rajah (D90) | **Ada dalam kod**: ekstrak (`intake/workflow/grouping`, `stimulusRef`), pembina kertas (`exam/builder`), kuiz (`bijak/kuiz/own-stimuli.ts`) | Data pindahan **tidak dikumpulkan** (rajah hilang, soalan berasingan) | 📄 kod · 👁 UAT |
| Studio cipta kumpulan dahulu, kemudian soalan (D93) | Ada | Ada (kod sama) | 📄 |
| Latih Tubi / Databank / Soalan by Chapter dengan kumpulan | **Mengecualikan** kumpulan (D91/D92: MCQ teks sahaja di R1) | Sama, tetapi soalan "Rajah n" **tanpa rajah** tetap disajikan kerana ia bukan kumpulan | 📄 · 👁 |
| Pokok DSKP (`curriculum_nodes`) | Dimuat | **0 nod** sehingga pemuat DSKP dijalankan (`docs/ops/dskp-loader.md`) | 📄 |
| Bab / Topik untuk murid | Demo: 1 subjek | **Kosong**: "Tiada subjek bab tersedia", Topik kosong, Peta Belajar 0/0 | 👁 |

### 5A.4 Kaedah tambah soalan oleh admin (V3) tidak menepati DSKP
| Kaedah | Masalah | Bukti |
|---|---|---|
| Manual (Studio) | Terbit ditolak lewat (422) kerana SP DSKP, aras pemikiran dan kertas belum diisi; bar "5 belum lengkap" tidak menyatakan apa yang kurang | 🧪 F1 |
| Tulis Soalan Manual (Kertas & SPM) | SP ditaip bebas dan hanya ditolak semasa Terima ("SP "12.1.1" tiada dalam senarai kurikulum") | 🧪 F2 |
| Muat naik kertas (PDF) | Ekstrak tersangkut "Sedang diproses"; kertas/bahagian yang dipilih semasa muat naik **tidak dibawa** ke soalan | 🧪 F2 |
| Import CSV | Tiada lajur DSKP (unit, SP, aras, kertas), jadi soalan import **tidak boleh diterbitkan** | 🧪 F2 |
| Kiriman Guru (kertas) | 503; admin "belum tersedia dalam demo" | 🧪 F9 |

### 5A.5 Paparan soalan kepada murid (V3, browser kelihatan 👁)
| Isu | Saiz |
|---|---|
| Soalan matriks ditulis sebagai **ayat** ("matriks (5 1; 2 3), iaitu baris pertama 5, 1 dan baris kedua 2, 3"), bukan notasi matematik | Semua |
| Bar bawah skrin menjawab Bijak SPM **tiada butang "Hantar"** | 375 |
| Label "Mod Peperiksaan" hilang; "Lapor Soalan" tergantung di baris sendiri | 375 |
| Petunjuk peta soalan "Dijawab · Ditanda · Belum" tanpa tanda warna | 1280 |

### 5A.6 Sumber panduan DSKP yang tersedia
| Sumber | Lokasi |
|---|---|
| PDF DSKP rasmi (13 subjek) | `D:\prestasiplus-dskp\` |
| 24 kertas percubaan sampel (BM, BI, Matematik, Matematik Tambahan, Fizik, Sejarah …) | `D:\prestasiplus-dskp\sampel-percubaan\` |
| Ekstrak DSKP (JSON) dan audit | `docs/reference/dskp/`, `docs/qa/audit/dskp-extracts-audit.md` |
| Blueprint kertas (1249-2, 1449-1, 1449-2, 3472-1, 3472-2, 4531-2) | `docs/reference/blueprints/` |
| Pemuat DSKP, ADR tag DSKP per bahagian | `docs/ops/dskp-loader.md`, ADR-0031, ADR-0036 |
| Skema peperiksaan diluluskan | `docs/requirements/v2-exam-schema.md` (D46/D47) |

---

## 6. Isu merentas sistem

| Isu | Butiran | Kesan |
|---|---|---|
| **Pemetaan DSKP (UAT)** | Soalan V2 dipindah tanpa bab/SP DSKP | Soalan by Chapter, Topik, Peta Belajar kosong; analitik DSKP tiada asas |
| **Tiada kertas & kontrak (UAT)** | 0 kontrak, 0 kertas | Bijak SPM — keutamaan utama — kosong untuk murid |
| **Sekolah menengah sahaja** | V3: latihan T4–T5 sahaja. UAT: 11 tahap (Darjah aktif) | Murid T1–T3 tiada latihan; UAT melanggar keputusan D72 |
| **Skop prototaip (D43)** | `prototype-scope.ts` menyorok halaman yang sudah dibina (Laporan Soalan, Import Pelajar, dll.) | Modul 1.0 hilang walaupun kodnya ada |
| **Laluan menu salah** | Laporan Mingguan, Analitik Adaptif (guru & admin sekolah), Monitoring admin → `/guru/monitoring` | 403 / skrin salah |
| **Angka bercanggah** | Model bacaan berbeza antara modul | Kepercayaan data rendah |
| **Binaan V3-GH rosak** | Langkah e2e seed gagal (`blueprint 3472/2 … NO_QUOTA, NO_KBAT`); API tidak naik sendiri | Binaan tidak boleh dipercayai tanpa campur tangan manual |
| **Had kadar API** | Navigasi pantas (±3 s/halaman) memberi 429 → skrin "Ralat" | Admin yang klik laju terkena |
| **UAT ≠ GitHub** | Hash binaan frontend berbeza | Hasil GH dan UAT perlu disemak berasingan |

---

## 7. Senarai pembetulan ikut keutamaan

### P0 — menyekat 1.0 (murid tak dapat guna modul teras)
| # | Pembetulan | Portal | Punca / lokasi |
|---|---|---|---|
| 1 | Cipta kontrak "Disahkan" & terbitkan kertas Bijak SPM di UAT; betulkan pintu kontrak supaya "Disahkan" boleh dipilih | Admin → Murid | Kontrak (F7), `0 kontrak` UAT |
| 2 | Petakan soalan UAT ke bab/SP DSKP (atau jambatan soalan → bab) | Admin → Murid | `curriculum_nodes`, jambatan MCQ (parity C08) |
| 3 | Prestasi murid → Prestasi 360 diri sendiri; buang `student` dari `PRESTASI_SCHOOL_ROLES` | Murid | `m08 routes/prestasi.ts:29` |
| 4 | Pulihkan Headcount, Analisa Item, Laporan Soalan untuk murid | Murid | `STUDENT_HIDDEN_IDS`, `analisa-item.ts:43`, `prototype-scope.ts` |
| 5 | Laporan Mingguan guru: betulkan laluan + bina skrin (ikut V2) | Guru | `user-nav.ts:287`, `m11 laporan-mingguan.ts:14` |
| 6 | Aktifkan pekerja ekstrak (worker + OCR) dan betulkan import supaya soalan boleh terbit | Admin | `jobs.worker.ts`, `intake-processing.service.ts` |
| 6a | **Kumpulan rajah (D90) hujung ke hujung**: kemasukan manual dan muat naik mencipta kumpulan dengan 1..n soalan; paparan rajah sekali (sticky di telefon); pembina kertas tidak memecahkan kumpulan | Admin → Murid | `intake/workflow/grouping`, `exam/builder`, `question-display` |
| 6b | **Soalan pindahan rosak**: kesan soalan "Rajah/Jadual/Petikan n" tanpa rajah dan teks berulang; sorok daripada murid; senarai kerja regroup untuk admin | Data UAT | Data V2 dipindah |
| 6c | **Kaedah tambah soalan ikut DSKP**: medan DSKP dipilih (bukan ditaip) semasa kemasukan, mesej jelas medan yang kurang, CSV dengan medan DSKP, struktur kertas dibawa dari muat naik; jalankan pemuat DSKP di UAT | Admin | `docs/ops/dskp-loader.md`, Studio, intake |
| 6d | **Skrin kertas soalan responsif** (375/768/1280) dan notasi matematik sebenar | Murid + Admin | `question-display`, skrin Bijak |
| 6e | **Tiada placeholder** ("Pratonton", "akan datang", "belum tersedia") pada mana-mana modul matriks (D100); murid T1–T3 diberi soalan seperti V2 (D101) | Semua | `prototype-scope.ts`, `PrototypeUnavailablePage` |

### P1 — fungsi penting tidak lengkap
| # | Pembetulan | Portal |
|---|---|---|
| 7 | Satukan menu soalan ikut V2: satu bank (Studio), satu pembina (Set Builder), satu baris gilir, Import & Semakan dengan 3 tab | Admin |
| 8 | Hub SPM 6 lorong; bina Tracking A & Kertas Subjektif (+ swa-markah murid) | Admin → Murid |
| 9 | Analitik Adaptif guru & admin sekolah → `/analitik/kelas` | Guru, Admin Sekolah |
| 10 | Kirkpatrick admin sekolah: buka Tahap 1–4, Rantaian, Intervensi | Admin Sekolah |
| 11 | Kiriman Guru: BE `/api/question-submissions` + menu admin | Guru → Admin |
| 12 | Nyahaktifkan Darjah di UAT (5 tahap sahaja); putuskan sama ada latihan T1–T3 dibuka | Semua |
| 13 | Skrin admin Gamifikasi, Kedai Hadiah/Kawalan Reward (BE sudah ada) | Admin → Murid |

### P2 — kualiti, data dan kelengkapan
| # | Pembetulan | Portal |
|---|---|---|
| 14 | Dashboard murid: Pakej SPM Aktif, Kombo, mood, Cabaran Kilat, Soalan Terkini | Murid |
| 15 | Profil Saya murid (profil awam, statistik, lencana) & Profil Guru | Murid, Guru |
| 16 | Remedial auto daripada subjek lemah | Murid |
| 17 | Satukan model bacaan angka sekolah; betulkan Amaran Awal (tiada data ≠ berisiko); Sekolah Bersaing fallback minggu terakhir | Admin Sekolah |
| 18 | Skrin admin Marketplace, Permainan, Kawalan Ciri, Laporan/Analitik pusat | Admin |
| 19 | Betulkan langkah e2e seed; longgarkan had kadar untuk admin | Infra |

---

## 8. Belum disahkan

| Perkara | Perlu |
|---|---|
| Portal Admin Sekolah di UAT | Akaun admin sekolah UAT (borang sudah diisi, tekan "Janakan Akaun Admin Sekolah") |
| 41 menu admin sekolah V2 | Akses V2 semula (IP baru sudah OK) |
| Murid / guru / admin sekolah V1 | Akaun V1 |
| Butang dalaman (Remedial/Evaluate/Badges, tab Laporan Aktiviti, dll.) | Ujian klik |
| Aliran import di UAT (ekstrak PDF) | Ujian di UAT (tulis data ujian) |

## 9. Lampiran bukti
| Folder | Isi |
|---|---|
| `.evidence/ (lokal, tidak dalam repo) screenshots/v2/` | Screenshot V2 (murid `v2-pupil-*`, murid kedua `v2-murid4-*`, guru `v2-guru-*`, admin sekolah `v2-adminsekolah-*`) + log |
| `.evidence/ (lokal, tidak dalam repo) screenshots/v3-github/` | Screenshot V3-GH murid, guru, admin sekolah + `ram.json` |
| `.evidence/ (lokal, tidak dalam repo) screenshots/v3-github/` | Screenshot V3-GH admin |
| `.evidence/ (lokal, tidak dalam repo) screenshots/v3-uat/` | Screenshot V3-UAT murid (T1 & `t5*`), guru, admin + `uat.json` |
| `docs/qa/gap-analysis-2026-11-04/MATRIX-EVIDENCE.md` | Jadual sel demi sel dengan nama screenshot |

`.evidence/ (lokal, tidak dalam repo) ` = gitignored evidence folder in the project root
