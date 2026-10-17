# Akaun Demo — Prototaip PrestasiPlus v2

Semua akaun ialah **akaun demo rekaan** dalam data tiruan (mock) prototaip. Ia tidak wujud di prestasiplus.my atau prestasiplus.cloud sebenar.

**Kata laluan semua akaun: `Demo1234`**

## Cara buka prototaip v2

### Pilihan 1: Pratonton tempatan (semak di sini dahulu)

Semua kerja v2 ada dalam folder projek asal, cabang `feature/student-prototype` (v2 telah digabung ke dalamnya, D48).

**Cara pantas (disyorkan): versi siap bina**

1. Bina: `npx vite build --mode demo --outDir dist-preview` (dengan `VITE_PROTOTYPE_SCOPE=on VITE_API_MODE=mock VITE_TEST_HOOKS=false`).
2. Jalankan: `npx vite preview --outDir dist-preview --strictPort --port <port kosong>`.
3. Buka alamat yang dipaparkan oleh server, kemudian pergi ke `/login`.
4. Bina semula selepas setiap perubahan kod, kemudian muat semula pelayar.

**Cara pembangunan:** `npm run dev`. Kali pertama dibuka ia lambat, sebab setiap fail diproses semasa diminta.

Skrin log masuk muncul dalam kira-kira 1 saat. Data tiruan mengambil lebih kurang 5 saat untuk siap selepas log masuk.

### Pilihan 2: Pautan demo dalam talian

Buka **https://claude.ai/artifact/5My2fSJfDXivvSUBmcVtbT** di telefon atau desktop.

- Pautan ini dikemas kini hanya selepas pemilik projek bersetuju dengan pratonton tempatan. Oleh itu ia mungkin ketinggalan sedikit berbanding pratonton tempatan.
- Data yang anda ubah (jawapan, syiling dan sebagainya) disimpan dalam pelayar anda sahaja.
- Pautan dalam app guna format `#/`, contohnya `…#/login`.

## Akaun dalam skop prototaip (boleh log masuk)

| Peranan | E-mel | Kegunaan |
|---|---|---|
| Murid (ada data) | `pelajar@demo.test` | Portal Pembelajaran: Dashboard, latihan, **Bijak SPM**, syiling dan lain-lain |
| Murid (maju) | `pelajarmaju@demo.test` | Murid dengan kemajuan lebih tinggi |
| Murid (kosong) | `pelajar2@demo.test` | Keadaan kosong (tiada data) |
| Guru | `guru@demo.test` | Skrin Guru (15 skrin matrix) |
| Admin Sekolah | `adminsekolah@demo.test` | Skrin Admin Sekolah (18 skrin matrix) |
| Admin (Admin Pusat) | `admin@demo.test` | **Portal Pentadbiran**: pantau sistem; terus ke Pemantauan › Langsung (Command Center) |
| Akaun tidak aktif | `tidakaktif@demo.test` | Untuk melihat mesej "akaun tidak aktif" |

## Akaun di luar skop

Akaun berikut wujud, tetapi dalam skop prototaip (TRACKER D43, D48) log masuknya memaparkan "Peranan ini tidak termasuk dalam prototaip.":

| Peranan | E-mel |
|---|---|
| Ibu Bapa | `ibubapa@demo.test` |
| Penaja | `penaja@demo.test` |
| Pegawai PPD | `ppd@demo.test` |
| Pegawai JPN | `jpn@demo.test` (dalam v2 digabung dengan Pegawai PPD, D31) |

Untuk menggunakannya, matikan skop: `VITE_PROTOTYPE_SCOPE=off npm run dev`.

## Portal Pentadbiran (Admin)

Log masuk sebagai `admin@demo.test`. Portal ini menggabungkan tiga panel admin lama, iaitu `/admin` (.my), admin.prestasiplus.cloud dan `/admin-filament`, menjadi satu panel (D30).

- **Menu sisi:** 9 kumpulan dan 100 item, ikut `docs/requirements/v2-portals.md`.
- **Command Center:** terletak di Pemantauan › Langsung (`/admin/command-center`), di dalam portal.
- **Item yang belum dibina:** termasuk ciri .cloud seperti admin Bijak SPM. Item ini membuka halaman "Belum tersedia dalam prototaip" (`/admin/p/<id>`), supaya bentuk penuh panel boleh dilihat.
- **Bar atas:** cip skop "Admin Pusat · Seluruh Negara", butang tema, dan menu akaun dengan "Masuk Mod Pelajar".

## Status tema baharu (v2)

| Peranan | Sudah dalam tema baharu | Masih rupa lama |
|---|---|---|
| Semua | Log Masuk, Daftar, Lupa/Reset Kata Laluan; Profil, Tetapan, Tiket Bantuan | — |
| Murid | Dashboard, Bijak SPM, Latih Tubi, Soalan by Chapter, Ulangkaji, Remedial, Soalan Berstruktur, Set Soalan, PKSK, Kelas Saya, Syiling & Token, Cabaran Harian, Pencapaian, Papan Pendahulu, Prestasi, Analitik Adaptif, Analisa Item, Video, Artikel, Audio KBAT, Panduan | Topik, Peta Belajar, Heatmap, Cikgu Alesa, Kedai Hadiah, Marketplace, Permainan, Kedudukan, Timeline |
| Guru | Dashboard Guru, Kelas Saya, Pelajar Saya, Sumbang Soalan, Prestasi, Analitik Adaptif, Analisa Item, Video | Command Center, Monitoring, Kirkpatrick, Headcount, Laporan |
| Admin Sekolah | Prestasi, Analitik Adaptif, Analisa Item, Video | Command Center, Monitoring, Kirkpatrick, Headcount, laporan sekolah, senarai pengguna |
| Admin | Bingkai Portal Pentadbiran | Isi Command Center dan skrin admin lain |

## Bijak SPM (murid)

Log masuk sebagai `pelajar@demo.test`. Buka **SPM**, kemudian **Bijak SPM** (`/spm/bijak`).

| Pautan | Skrin |
|---|---|
| `/spm/bijak` | Hab Bijak SPM: kad hero "Sambung kertas" / "Mula kertas" |
| `/spm/bijak/sejarah` | Sejarah percubaan |
| `/spm/bijak/kertas/:paperId` | Kulit kertas: masa, markah, bahagian A/B/C, pilihan "jawab N daripada M" |
| `/spm/bijak/percubaan/:attemptId` | Menjawab: rajah dikongsi, papan kekunci matematik, autosimpan |
| `/spm/bijak/percubaan/:attemptId/keputusan` | Keputusan: kod markah ikut subjek (K1/N1/P1, M, F/C) |

Had yang diketahui ada dalam `docs/requirements/v2-bijak-spm.md` ("Known limitations").

## Pautan reset kata laluan demo

| Pautan | Hasil |
|---|---|
| `/password/reset/demo-reset-token?email=pelajar@demo.test` | Token sah: boleh tukar kata laluan dan log masuk |
| `/password/reset/demo-expired-token?email=pelajar@demo.test` | Token tamat tempoh: mesej ralat |

Token sah boleh digunakan sekali sahaja. Muat semula aplikasi untuk set semula data demo.

## Nota teknikal

- **Skop prototaip (D43, D48):** aktif secara lalai dalam semua mod. Skrin Murid, Guru dan Admin Sekolah ikut `docs/requirements/role-access-matrix.md`, yang mengatasi senarai lama "Release 1.0". Admin pula boleh membuka semua skrin admin. `/__ds` (galeri sistem reka bentuk) sentiasa boleh dibuka.
- **Profil data (D45):** dalam skop prototaip, set data besar (soalan, jawapan, sesi, lejar syiling) dikecilkan. Semua akaun demo dan rekod sauh kekal. `VITE_DATA_PROFILE=full` memulihkan data penuh. Vitest dan e2e sentiasa guna `full`. Lihat `src/mock/dataset/data-profile.ts`.
