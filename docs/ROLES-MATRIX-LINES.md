# Baris Matriks Peranan: Rujukan Agihan Sesi

Sumber: `roles-matrix/Matriks-Akses-Peranan .xlsx`, helaian "Matriks Akses".
Keputusan pengguna **D21 (2026-10-02)**: setiap baris dibawa ke 100% (G1 hingga G5), baris demi baris. D21 menggantikan susunan admin-first D19.

## Cara kiraan %

| Tahap | % |
|---|---|
| Keperluan (G1) belum lulus | 0% |
| G1 lulus, skrin belum dibina | 40% |
| Dibina dan lulus semakan kod (G4), QA akhir belum lulus | 85% |
| Lulus QA akhir (G5) | 100% |

Singkatan peranan: M = Murid, G = Guru, AS = Admin Sekolah. Tanda ★ bermaksud baris itu ada dalam Release 1.0, iaitu lajur "1.0" dalam matriks.

## Senarai baris

Status di bawah ialah status pada 2026-10-02.

| No. | Menu (# matriks) | Peranan | Modul | % |
|---|---|---|---|---|
| L01 | Profil Saya (A1) | M★ G★ AS | M01 | **100%** |
| L02 | Tetapan Peribadi (A2) | M★ G★ AS | M01 | **100%** |
| L03 | Panduan (A3) | M★ G★ AS | M09 | **100%** |
| L04 | Tiket Bantuan (A4) | M G AS | M22 | 40% |
| L05 | Log Keluar (A5) | M★ G★ AS★ | M01 | **100%** |
| L06 | Command Center (1) | G★ AS★ | M11 | **100%** |
| L07 | Dashboard / Dashboard Guru (2) | M★ G★ AS | M17 / M05 | 40% |
| L08 | Headcount (3) | M★ G★ AS★ | M08 | **100%** |
| L09 | Prestasi (4) | M★ G★ AS★ | M08 | **100%** |
| L10 | Analitik Adaptif (5) | M★ G★ AS★ | M08 | **100%** |
| L11 | Analisa Item (6) | M★ G★ AS★ | M08 | **100%** |
| L12 | Video (7) | M★ G★ AS★ | M09 | **100%** |
| L13 | Kelas Saya (8) | M★ G★ | M10 | **100%** |
| L14 | Soalan by Chapter (9) | M★ G★ | M05 | **100%** |
| L15 | Monitoring (10) | G★ AS★ | M11 | **100%** |
| L16 | Kirkpatrick (11) | G★ AS★ | M12 | **100%** |
| L17 | Remedial (12) | M★ | M05 | **100%** |
| L18 | SPM (13) | M★ | M06 | 40% |
| L19 | Heatmap Topik Lemah (14) | M★ | M25 (`/buku-nota/heatmap`; G4 lulus 2026-10-10; F-19b href menu belum) | 85% |
| L20 | Mohon Keluarga Angkat (15) | M | M21 (S6; G5 READY 2026-10-10, `docs/qa/M21-sponsorship.md`) | **100%** |
| L21 | Latih Tubi (16) | M | M05 | **100%** |
| L22 | Soalan Berstruktur (17) | M | M04 / M05 | **100%** |
| L23 | Kedudukan (18) | M | M08 | **100%** |
| L24 | PKSK (19) | M | M07 | **100%** |
| L25 | Artikel (20) | M | M09 | **100%** |
| L26 | Permainan (21) | M★ | M16 | 40% |
| L27 | Cabutan Bertuah (22) | M | M15 | **100%** |
| L28 | Tournament (23) | M | M16 | 40% |
| L29 | Topik (24) | M | M03 (S12–S13; G5 READY 2026-10-10, `docs/qa/M03-curriculum.md`) | **100%** |
| L30 | Peta Belajar (25) | M | M03 (S14; G5 READY 2026-10-10, `docs/qa/M03-curriculum.md`) | **100%** |
| L31 | Set Soalan Guru (26) | M | M10 (perlu pengesahan) | **100%** |
| L32 | Audio KBAT (27) | M | M09 | **100%** |
| L33 | Syiling & Token (28) | M | M14 | **100%** |
| L34 | Tukar Token (29) | M | M14 | **100%** |
| L35 | Cabaran Harian (30) | M | M14 | **100%** |
| L36 | Kedai Hadiah (31) | M | M15 | **100%** |
| L37 | Marketplace (32) | M | M20 | 40% |
| L38 | Papan Pendahulu (33) | M | M08 | **100%** |
| L39 | Pencapaian (34) | M | M14 | **100%** |
| L40 | Kotak Misteri (35) | M | M15 | **100%** |
| L41 | Rujuk Kawan (36) | M | M14 | **100%** |
| L42 | Cikgu Alesa (37) | M | M13 (S1–S6; G4 lulus 2026-10-10) | 85% |
| L43 | Kedai Hadiah Digital (38) | M | M15 (S10 `/cikgu/hadiah`, S11 `/cikgu/hadiah/saya`) | **100%** |
| L44 | Timeline Saya (39) | M | M08 | **100%** |
| L45 | Jemput Ibu Bapa (40) | M | M02 (skrin, token, pautan) + M01 (halaman terima), D23 | **100%** |
| L46 | Pelajar Saya (41) | G★ | M10 | **100%** |
| L47 | Laporan (42) | G★ | M11 | **100%** |
| L48 | Laporan Mingguan (43) | G★ | M08 | **100%** |
| L49 | Sumbang Soalan (44) | G★ | M04 | **100%** |
| L50 | Sekolah Bersaing (45) | AS★ | M16 (S28 `/sekolah-bersaing`, M16-T6a; bukan M26) — Sesi 7 | 40% |
| L51 | Statistik Penggunaan (46) | AS★ | M27 (Sesi 2; Part B S1–S11) | 40% |
| L52 | DSKP Heatmap (47) | AS★ | M27 (Sesi 2; Part B S1–S11) | 40% |
| L53 | Laporan Aktiviti (48) | AS★ | M27 (Sesi 2; Part B S1–S11) | 40% |
| L54 | Amaran Awal (49) | AS★ | M27 (Sesi 2; Part B S1–S11) | 40% |
| L55 | Laporan Bulanan (50) | AS★ | M27 (Sesi 2; Part B S1–S11) | 40% |
| L56 | Senarai Pelajar (51) | AS★ | M27 (Sesi 2; Part B S1–S11) | 40% |
| L57 | Senarai Guru (52) | AS★ | M27 (Sesi 2; Part B S1–S11) | 40% |
| L58 | Kelas Sekolah (53) | AS★ | M27 (Sesi 2; Part B S1–S11) | 40% |
| L59 | Laporan Soalan (54) | M★ | M04 | **100%** |

Purata semasa (dikira semula 2026-10-03 daripada lajur % di atas):

| Peranan | Menu modul | Menu modul, Release 1.0 | Termasuk Asas Akaun | Termasuk Asas Akaun, Release 1.0 |
|---|---|---|---|---|
| Murid | 82.2% | 81.5% | 81.9% | 85.9% |
| Guru | 93.0% | 93.0% | 89.8% | 94.5% |
| Admin Sekolah | 47.2% | 47.6% | 54.3% | 50.6% |

## Pembahagian sesi

Satu modul hanya dipegang oleh satu sesi. Jangan biarkan dua sesi menyentuh data atau fail modul yang sama.

| Sesi | Baris | Modul yang dimiliki | Nota |
|---|---|---|---|
| 1 | L08, L09, L10, L11, L23, L38, L44, L48 | M08, ditambah data M05 dan M10 untuk bug M08 | **Selesai 2026-10-02:** M08 lulus G5 (READY), kesemua lapan baris 100%. Lihat `docs/qa/M08-student-performance.md`. |
| 2 | L01, L02, L05, L45 | M01, M02 | |
| 3 | L03, L12, L25, L32 | M09 | Bahagian M09 admin sudah separuh dibina dan ditangguhkan (D21) |
| 4 | L14, L17, L21, L22 | M05, M04 (bahagian murid) | **Selesai 2026-10-03 (sesi "1"):** M05-T2, T4, T5, T7 lulus G4; G5 READY (`docs/qa/M05-practice.md`); keempat-empat baris 100%. |
| 5 | L27, L33, L34, L35, L36, L39, L40, L41, L43 | M14, M15 | |
| 6 | L06, L13, L15, L16, L31, L46, L47, L49 | M10, M11, M12 | Selaras dengan Sesi 1 jika menyentuh data M10 |
| 7 | L18, L19, L20, L24, L26, L28, L29, L30, L37, L42 | M06, M07, M16, M03, M20, M21, M13, M25 (Heatmap sahaja) | **Dijeda 2026-10-03** (PC ditutup). Termasuk L50 (M16 S28, diambil daripada Sesi 2). Pengendali M03/M06/M07/M13/M16 (T1+T2)/M20/M21 dan skrin M03-T4, M06-T2, M06-T4, M07-T2, M13-T2 sudah digabungkan; G3 belum lulus (E2E M03 gagal, M06/M07/M13 belum diuji). M25 G1 lulus; XL-R10 terbuka. Langkah sambung: lihat log TRACKER 2026-10-03 "Session 7 PAUSED". Port E2E 50xx. |
| 8 | L07 | M10-T2 (Guru `/guru`), M05-T3 (Murid `/dashboard`, dengan izin Sesi 1), M27 S0 (Admin Sekolah `/admin-sekolah`, dikongsi dengan Sesi 2) | **Dijeda 2026-10-03:** Guru lulus G5; Murid lulus G4, G5 separuh jalan; Admin Sekolah lulus G1 dan sedang dibina. Bukan M17 S1, kerana `/admin` ialah admin platform, bukan peranan L07. Lihat log TRACKER. |
| Disekat → Sesi 2 | L04, L51 hingga L58 (L50 → Sesi 7, M16 S28) | M22, M27 (teras + S1+; S0/L07 milik Sesi 8) | Dinyahsekat oleh D24 (kod server sebagai spesifikasi). Penemuan bermula 2026-10-03. |

## Peraturan untuk setiap sesi

1. Baca `CLAUDE.md` dan `docs/TRACKER.md` dahulu. Semua gate G1 hingga G6 dan peraturan fideliti terpakai.
2. Sunting hanya fail modul sesi sendiri. Perubahan pada stor milik modul lain mesti melalui sesi pemilik modul itu.
3. TRACKER.md:
   - Kemas kini baris modul sendiri sahaja.
   - Tambah log perubahan di bahagian atas jadual "## 8. Change log".
   - Baca semula fail itu sebelum menyunting.
4. Port E2E: setiap sesi guna julat portnya sendiri. Contohnya Sesi 1 guna 46xx, Sesi 2 guna 47xx, dan seterusnya. Jangan guna port 4173 atau 5173.
5. Scratchpad: setiap agen guna subfolder sendiri.
6. Had Sonnet dikongsi oleh semua sesi dalam akaun yang sama. Lebih banyak sesi tidak menambah kapasiti.
7. Kemas kini lajur % dalam fail ini apabila sesuatu baris berubah tahap.
