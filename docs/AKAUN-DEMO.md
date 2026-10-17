# Akaun Demo — Prototaip PrestasiPlus v2

Semua akaun ialah **akaun demo rekaan** dalam data tiruan (mock) prototaip. Ia tidak wujud di prestasiplus.my atau prestasiplus.cloud sebenar.

**Kata laluan semua akaun: `Demo1234`**

## Cara buka prototaip v2

### Pilihan 1: Pratonton tempatan (semak di sini dahulu)

1. Folder v2: `D:\Dev Projects\pretasiplus-v2`, cabang `feature/v2-frontend`.
2. Jalankan server dalam folder itu: `npx vite --port 5180 --strictPort`.
3. Buka **http://localhost:5180/login**.
4. Skrin log masuk muncul dalam kira-kira 1 saat. Data tiruan mengambil lebih kurang 5 saat untuk siap.

> Port **5173** ialah prototaip lama (folder `pretasiplus-app`, cabang `feature/student-prototype`). Ia bukan v2.

### Pilihan 2: Pautan demo dalam talian

Buka **https://claude.ai/artifact/5My2fSJfDXivvSUBmcVtbT** di telefon atau desktop.

- Pautan ini dikemas kini hanya selepas pemilik projek bersetuju dengan pratonton tempatan. Oleh itu ia mungkin ketinggalan sedikit berbanding pratonton tempatan.
- Data yang anda ubah (jawapan, syiling dan sebagainya) disimpan dalam pelayar anda sahaja.
- Pautan dalam app guna format `#/`, contohnya `…#/login`.

## Akaun dalam skop prototaip (boleh log masuk)

| Peranan | E-mel | Kegunaan |
|---|---|---|
| Murid (ada data) | `pelajar@demo.test` | Dashboard murid, latihan, syiling, **Bijak SPM** |
| Murid (maju) | `pelajarmaju@demo.test` | Murid dengan kemajuan lebih tinggi |
| Murid (kosong) | `pelajar2@demo.test` | Keadaan kosong (tiada data) |
| Guru | `guru@demo.test` | Portal guru |
| Admin Sekolah | `adminsekolah@demo.test` | Skrin Admin Sekolah |
| Akaun tidak aktif | `tidakaktif@demo.test` | Untuk melihat mesej "akaun tidak aktif" |

## Akaun di luar skop

Akaun berikut wujud, tetapi dalam skop prototaip (TRACKER D43) log masuknya memaparkan "Peranan ini tidak termasuk dalam prototaip.":

| Peranan | E-mel |
|---|---|
| Admin | `admin@demo.test` |
| Ibu Bapa | `ibubapa@demo.test` |
| Penaja | `penaja@demo.test` |
| Pegawai PPD | `ppd@demo.test` |
| Pegawai JPN | `jpn@demo.test` (dalam v2 digabung dengan Pegawai PPD, D31) |

Untuk menggunakannya, matikan skop: `VITE_PROTOTYPE_SCOPE=off npx vite --port 5180 --strictPort`.

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

- **Skop prototaip (D43):** aktif secara lalai dalam semua mod. Hanya skrin Murid, Guru dan Admin Sekolah dalam `docs/requirements/role-access-matrix.md` dipaparkan. `/__ds` (galeri sistem reka bentuk) sentiasa boleh dibuka.
- **Profil data (D45):** dalam skop prototaip, set data besar (soalan, jawapan, sesi, lejar syiling) dikecilkan. Semua akaun demo dan rekod sauh kekal. `VITE_DATA_PROFILE=full` memulihkan data penuh. Vitest dan e2e sentiasa guna `full`. Lihat `src/mock/dataset/data-profile.ts`.
