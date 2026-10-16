# Akaun Demo — Prototaip PretasiPlus

Semua akaun ialah **akaun demo rekaan** dalam data tiruan (mock) prototaip. Ia tidak wujud di prestasiplus.my sebenar.

**Kata laluan semua akaun: `Demo1234`**

## Cara buka prototaip

1. Pastikan server tempatan sedang berjalan: `npm run dev`.
2. Buka **http://127.0.0.1:5173/login**.
3. Aplikasi mungkin mengambil 5–10 saat untuk dimuatkan kali pertama.

## Akaun utama

| Peranan | E-mel | Kegunaan |
|---|---|---|
| Admin | `admin@demo.test` | Panel admin (`/admin/...`) |
| Murid (ada data) | `pelajar@demo.test` | Dashboard murid, latihan, syiling |
| Murid (maju) | `pelajarmaju@demo.test` | Murid dengan kemajuan lebih tinggi |
| Murid (kosong) | `pelajar2@demo.test` | Keadaan kosong (tiada data) |
| Guru | `guru@demo.test` | Portal guru (`/guru`) |
| Admin Sekolah | `adminsekolah@demo.test` | Skrin Admin Sekolah |
| Ibu Bapa | `ibubapa@demo.test` | Akaun ibu bapa |
| Penaja | `penaja@demo.test` | Akaun penaja |
| Pegawai PPD | `ppd@demo.test` | Pegawai daerah |
| Pegawai JPN | `jpn@demo.test` | Pegawai negeri |
| Akaun tidak aktif | `tidakaktif@demo.test` | Untuk melihat mesej "akaun tidak aktif" |

## Pautan reset kata laluan demo

| Pautan | Hasil |
|---|---|
| `/password/reset/demo-reset-token?email=pelajar@demo.test` | Token sah: boleh tukar kata laluan dan log masuk |
| `/password/reset/demo-expired-token?email=pelajar@demo.test` | Token tamat tempoh: mesej ralat |

Token sah boleh digunakan sekali sahaja. Jika mahu cuba lagi, set semula data demo dengan memuat semula aplikasi dalam mod pembangunan.

## Halaman berguna (dev sahaja)

| Pautan | Kegunaan |
|---|---|
| `/__dev/shell` | Pratonton bingkai menu setiap peranan: Murid, Guru, Admin Sekolah, Admin |
| `/__dev/tokens` | Galeri warna dan token reka bentuk |
| `/__dev/feedback` | Galeri komponen mesej, amaran dan modal |
| `/__ds` | Galeri sistem reka bentuk (sentiasa boleh dibuka dalam semua mod) |

Skop prototaip (TRACKER D43) aktif secara lalai dalam semua mod (`npm run dev`, demo dan artifact): hanya skrin Murid, Guru dan Admin Sekolah dalam `docs/requirements/role-access-matrix.md` dipaparkan. Pautan `/__dev/*` dan halaman pautan semua skrin (`/admin`) tidak wujud dalam skop ini. Satu suis sahaja: `VITE_PROTOTYPE_SCOPE=off` (contoh: `VITE_PROTOTYPE_SCOPE=off npm run dev`) mematikan skop. Akaun di luar skop (admin, ibu bapa, penaja, PPD, JPN) hanya muncul apabila `VITE_PROTOTYPE_SCOPE=off`; dalam skop, log masuk akaun ini dipaparkan "Peranan ini tidak termasuk dalam prototaip."

## Status skrin (dikemas kini oleh Delivery Lead)

| Modul | Skrin | Status |
|---|---|---|
| M01 | Log Masuk, Daftar, Lupa / Reset Kata Laluan, Reset melalui IC | Siap, boleh dicuba |
| M02 | Pengguna, Sekolah, Import, Langganan (admin) | Siap, boleh dicuba |
| M04 | Bank Soalan: senarai, butiran, tambah/edit, import CSV, kualiti, soalan berstruktur, laporan (admin) | Siap, boleh dicuba |
| M08 | Prestasi Murid: prestasi sekolah/tingkatan/kelas, analitik, analisa item, headcount, kedudukan | Boleh dilihat; ujian akhir (QA) belum |
| Lain-lain | Dashboard murid, portal guru, dan lain-lain | Belum dibina; paparan kosong atau 404 |

Selepas log masuk sebagai admin, buka **http://127.0.0.1:5173/admin** untuk senarai pautan semua skrin yang sudah boleh dilihat.
