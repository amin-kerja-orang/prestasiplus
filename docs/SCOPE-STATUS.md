# Status Skop Prototaip (Release 1.0)

Dikemas kini: 2026-10-11. Sumber: `docs/ROLES-MATRIX-LINES.md` (59 baris L01-L59) dan `docs/TRACKER.md`.

Sidebar, drawer mudah alih dan popover "Lagi" meniru menu PENUH laman live. Item untuk modul yang belum dibina TIDAK dipaparkan (supaya tiada pautan 404). Definisi item kekal sebagai data dalam `src/shells/nav/user-nav.ts`; senarai item tersembunyi ialah satu fail: `src/shells/nav/out-of-scope.ts` (`OUT_OF_SCOPE_ROUTES`). Untuk memulihkan item selepas modulnya siap, padam barisnya dalam fail itu sahaja.

## 1. SIAP (dalam skop, 100%)

Semua 59 baris matriks berada pada 100% (G5 READY). Tanda ★ = Release 1.0. Setiap item menu baris ini membuka skrin sebenar.

| Peranan | Baris (L-rows) | Bilangan | Modul |
|---|---|---|---|
| Murid | L01-L05, L07-L14, L17-L45, L59 | 43 | M01, M03-M10, M13-M16, M20-M22, M25 (Heatmap sahaja) |
| Murid, ★ 1.0 | L01 L02 L03 L05 L07 L08-L14 L17 L18 L19 L26 L59 | 17 | M01, M03-M06, M08-M10, M16, M25 |
| Guru | L01-L06, L07, L08-L16, L46-L49 | 20 | M01, M04, M05, M08-M12, M22 |
| Guru, ★ 1.0 | semua baris Guru kecuali L04 | 19 | sama |
| Admin Sekolah | L01-L06, L07, L08-L12, L15, L16, L50-L58 | 23 | M01, M08, M09, M11, M12, M16, M22, M27 |
| Admin Sekolah, ★ 1.0 | L05 L06 L08-L12 L15 L16 L50-L58 | 18 | sama |

Menu yang dibuka (nama label sidebar): Murid, Dashboard, Headcount, Prestasi, Analitik Adaptif, Analisa Item, Video, Kelas Saya, Soalan by Chapter, Remedial, SPM, Heatmap Topik Lemah, Mohon Keluarga Angkat, Latih Tubi, Soalan Berstruktur, Kedudukan, PKSK, Artikel, Permainan, Cabutan Bertuah, Tournament, Topik, Peta Belajar, Set Soalan Guru, Audio KBAT, Syiling & Token, Tukar Token, Cabaran Harian, Kedai Hadiah, Marketplace, Papan Pendahulu, Pencapaian, Kotak Misteri, Rujuk Kawan, Cikgu Alesa, Kedai Hadiah Digital, Timeline Saya, Jemput Ibu Bapa, Laporan Soalan. Guru: Command Center, Dashboard Guru, Headcount, Prestasi, Analitik Adaptif, Analisa Item, Video, Kelas Saya, Soalan by Chapter, Monitoring, Kirkpatrick, Pelajar Saya, Laporan, Laporan Mingguan, Sumbang Soalan. Admin Sekolah: Command Center, Dashboard, Headcount, Prestasi, Analitik Adaptif, Analisa Item, Video, Monitoring, Kirkpatrick, Sekolah Bersaing, Statistik Penggunaan, DSKP Heatmap, Laporan Aktiviti, Amaran Awal, Laporan Bulanan, Senarai Pelajar, Senarai Guru, Kelas Sekolah.

Nota pembetulan href baris 1.0 (item menu menuding ke laluan salah):

| Peranan | Item | Dari | Ke | Baris |
|---|---|---|---|---|
| Guru (dan Admin platform) | Laporan Mingguan | `/guru/laporan-mingguan-kelas` (404, M11-T5 belum dibina) | `/laporan-mingguan` (skrin M08 S21, selaras kajian live: 403 untuk semua peranan, OQ-M08-01) | L48 |

Nota: `/laporan-mingguan` memaparkan halaman 403 yang dijejaki live (M08 S21, G5 lulus). Ia bukan 404.

## 2. LUAR SKOP, DISEMBUNYI

Item menu di bawah memberi 404 kerana modulnya belum dibina dan bukan baris matriks. Ia tidak dirender untuk mana-mana peranan, tetapi masih wujud dalam data nav.

| Href | Item menu | Peranan terjejas | Modul | Sebab |
|---|---|---|---|---|
| `/bilik-duta` | Bilik Duta | Murid | M24 Duta | belum dibina |
| `/akademi-duta` | Akademi Duta | Murid | M24 Duta | belum dibina |
| `/bilik-duta/kem` | Kem & Bootcamp | Murid | M24 Duta | belum dibina |
| `/cita-cita` | Cita-Cita Saya / Cita-Cita Hijrah | Murid | M26 Visi & Ciri Khas | belum dibina |
| `/cita-cita/universiti` | Universiti | Murid | M26 | belum dibina |
| `/cita-cita/biasiswa` | Biasiswa | Murid | M26 | belum dibina |
| `/profil-cerah` | Profil Cerah | Murid | M26 | belum dibina |
| `/psikometrik` | Psikometrik | Murid | M26 | belum dibina |
| `/pusat-kerjaya` | Pusat Kerjaya | Murid | M26 | belum dibina |
| `/pusat-ilmu-sekolah` | Pusat Ilmu Sekolah | Murid | M26 | belum dibina |
| `/cikgu-suara` | Cikgu Suara | Murid | M26 | belum dibina |
| `/pembetulan` | Pembetulan | Murid | M26 | belum dibina |
| `/penguasaan` | Penguasaan | Murid | M26 | belum dibina |
| `/streak` | Streak Saya | Murid | M26 | belum dibina |
| `/kombo` | Kombo / Kombo Harian | Murid, Guru, Admin Sekolah | M26 | belum dibina |
| `/liga` | Liga Pertandingan | Murid, Guru, Admin Sekolah | M26 | belum dibina |
| `/perutusan` | Perutusan | Murid, Guru, Admin Sekolah | M26 | belum dibina (juga ditangguh dalam AC-04.2 L07) |
| `/wellbeing/alerts` | Wellbeing Alerts | Murid, Guru, Admin Sekolah | M26 Wellbeing | belum dibina |
| `/pusat-nota-ringkas` | Pusat Nota Ringkas | Murid | M25 Pusat AI | belum dibina (hanya Heatmap Topik Lemah dalam skop) |
| `/buku-nota-saya` | Buku Nota Saya | Murid | M25 | belum dibina |
| `/pusat-ai/mood` | Mood Saya | Murid | M25 | belum dibina |
| `/pusat-ai/kamus` | Kamus AI | Murid, Guru, Admin Sekolah | M25 | belum dibina |
| `/pusat-ai/pendamping` | Pendamping Motivasi | Murid, Guru, Admin Sekolah | M25 | belum dibina |
| `/pusat-ai/doa` | Doa & Motivasi | Murid, Guru, Admin Sekolah | M25 | belum dibina |
| `/pusat-ai/aktiviti` | Aktiviti Advisor | Guru, Admin Sekolah | M25 | belum dibina |
| `/pusat-ai/whiteboard` | Whiteboard Quiz | Guru, Admin Sekolah | M25 | belum dibina |
| `/billing/invoices` | Invois Saya | Murid | M19 Kewangan & Langganan | belum dibina |
| `/amaran` | Amaran Awal (Guru) | Guru | M27 | Amaran Awal hanya baris Admin Sekolah (L54, `/amaran/sekolah`) |
| `/guru/misi-harian` | Misi Harian | Guru | Portal Guru (lanjutan) | bukan baris matriks |
| `/guru/verify-soalan-struktur` | Verify Soalan Struktur | Guru | Portal Guru (lanjutan) | bukan baris matriks |
| `/guru/verify-soalan-mcq` | Verify Soalan MCQ | Guru | Portal Guru (lanjutan) | bukan baris matriks |
| `/guru/kehadiran-digital` | Kehadiran Digital | Guru | Portal Guru (lanjutan) | bukan baris matriks |
| `/guru/jadual-belajar` | Jadual Belajar | Guru | Portal Guru (lanjutan) | bukan baris matriks |
| `/guru/broadcast` | Broadcast | Guru | Portal Guru (lanjutan) | bukan baris matriks |
| `/guru/live-kelas` | Kelas Live | Guru | Portal Guru (lanjutan) | bukan baris matriks |
| `/guru/perbandingan-kelas` | Perbandingan Kelas | Guru | M11 (S7, M11-T4) | belum dibina; bukan baris matriks |
| `/guru/soalan-guru` | Soalan & Rujukan | Guru | Portal Guru (lanjutan) | bukan baris matriks |
| `/guru/soalan-berstruktur` | Soalan Berstruktur (Guru) | Guru | Portal Guru (lanjutan) | bukan baris matriks (L22 ialah Murid) |
| `/guru/databank` | Databank Soalan | Guru | Portal Guru (lanjutan) | bukan baris matriks |
| `/guru/set-soalan` | Set Soalan | Guru | Portal Guru (lanjutan) | bukan baris matriks (L31 ialah Murid) |
| `/guru/kertas-peperiksaan` | Kertas Peperiksaan | Guru | Portal Guru (lanjutan) | bukan baris matriks |
| `/guru/penjana-peperiksaan` | Penjana Peperiksaan | Guru | Portal Guru (lanjutan) | bukan baris matriks |
| `/guru/gamifikasi` | Syiling & Ganjaran (Guru) | Guru | Portal Guru (lanjutan) | bukan baris matriks |
| `/guru/artikel` | Sumbang Artikel | Guru | Portal Guru (lanjutan) | bukan baris matriks |
| `/admin-sekolah/pengguna` | Urus Pengguna | Admin Sekolah | M27 (lanjutan) | bukan baris L51-L58 |
| `/admin-sekolah/import-pelajar` | Import Pelajar | Admin Sekolah | M27 (lanjutan) | bukan baris L51-L58 |
| `/admin-sekolah/aktiviti-guru` | Aktiviti Guru | Admin Sekolah | M27 (lanjutan) | bukan baris L51-L58 |
| `/admin-sekolah/langganan` | Langganan | Admin Sekolah | M19 Kewangan & Langganan | belum dibina |
| `/admin-sekolah/invois` | Invois | Admin Sekolah | M19 Kewangan & Langganan | belum dibina |
| `/admin/audit-log` | Audit Log | Admin Sekolah | M25 Pusat AI (Kawalan Kualiti) | belum dibina |

Pengecualian: menu Admin platform (`ADMIN_NAV`, panel `/admin`) tidak diubah; ia di luar tiga peranan prototaip dan ditangguh (jadual 3).

## 3. SAMBUNG NEXT (ditangguh)

| Modul besar | Kandungan | Status |
|---|---|---|
| Bijak SPM / Pusat AI penuh (M25) | Kamus AI, Pendamping Motivasi, Doa & Motivasi, Aktiviti Advisor, Whiteboard Quiz, Mood, Nota Ringkas, Semakan Nota Master, Audit Log AI | Hanya Heatmap Topik Lemah (L19) siap |
| Portal Admin platform (M17, M23) | Panel `/admin` penuh: sistem, tetapan, audit, kandungan | M17 siap sebahagian; M23 belum |
| Portal PPD dan JPN (M18) | Dashboard, statistik, ranking, peta haba, eksport | Belum dalam skop 3 peranan |
| Duta (M24) | Bilik Duta, Akademi Duta, Kem & Bootcamp, permohonan | Belum dibina |
| Wellbeing (M26) | Wellbeing Alerts, Pendamping | Belum dibina |
| Cita-Cita (M26) | Cita-Cita Saya, Universiti, Biasiswa, Psikometrik, Pusat Kerjaya | Belum dibina |
| Finance / Billing (M19) | Invois, Langganan, Pakej, Dunning | Belum dibina |
| Ciri Visi lain (M26) | Streak, Kombo, Liga, Perutusan, Profil Cerah, Pembetulan, Penguasaan, Cikgu Suara | Belum dibina |
| Alat Portal Guru lanjutan | Misi Harian, Verify Soalan, Kehadiran Digital, Jadual Belajar, Broadcast, Kelas Live, Perbandingan Kelas (M11-T4), Databank, Kertas dan Penjana Peperiksaan, dll. | Belum dibina |
| Alat Admin Sekolah lanjutan | Urus Pengguna, Import Pelajar, Aktiviti Guru | Belum dibina |
