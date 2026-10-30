# Akaun Demo — Stack Penuh Lokal (API + PostgreSQL)

Akaun ini datang daripada seed demo API (`apps/api/prisma/seed`, profil `poc`). Semuanya rekaan dan hanya wujud dalam pangkalan data lokal. Untuk prototaip mock (tanpa API), rujuk [AKAUN-DEMO.md](AKAUN-DEMO.md).

**URL:** http://localhost:5192/login
**Kata laluan semua akaun: `Demo1234`**

Disemak dengan log masuk sebenar ke API pada 29 Okt 2026.

## Cara uji

1. Pastikan stack hidup: `npm run stack:up` (kali pertama atau selepas ubah kod), atau semak http://localhost:5192/api/health (mesti `"status":"ok","db":"up"`).
2. Buka http://localhost:5192/login.
3. Masukkan e-mel di bawah dan kata laluan `Demo1234`.
4. Untuk tukar peranan: log keluar, kemudian log masuk dengan akaun lain.

## Portal Pentadbiran

| E-mel | Peranan | Skop |
|---|---|---|
| `admin@demo.test` | Admin Pusat | Seluruh Negara |
| `adminsekolah@demo.test` | Admin Sekolah | SMK Demo Satu |
| `guruadmin@demo.test` | Admin Sekolah **dan** Guru (dua peranan, boleh tukar portal) | SMK Demo Satu |

## Portal Pembelajaran

| E-mel | Peranan | Nota |
|---|---|---|
| `guru@demo.test` | Guru | SMK Demo Satu; kelas "Kelas Demo Tingkatan 4" (kod `DEMO4S`) |
| `pelajar@demo.test` | Murid | Murid utama, ada sejarah Bijak SPM |
| `pelajarmaju@demo.test` | Murid | Murid "maju", untuk modul permainan |
| `pelajar2@demo.test` | Murid | Sengaja tiada sejarah (keadaan kosong) |
| `murid4@demo.test` – `murid8@demo.test` | Murid | Tingkatan 4 dalam kelas guru demo, ada keputusan peperiksaan |

## Akaun yang disekat oleh skop prototaip

Akaun ini sah di API, tetapi frontend dibina dengan `VITE_PROTOTYPE_SCOPE=on` (lalai), jadi log masuk memaparkan **"Peranan ini tidak termasuk dalam prototaip."** (disemak 29 Okt 2026).

| E-mel | Peranan | Skop |
|---|---|---|
| `ibubapa@demo.test` | Ibu Bapa | — |
| `penaja@demo.test` | Penaja | — |
| `ppd@demo.test` | Pegawai PPD | Petaling |
| `jpn@demo.test` | Pegawai JPN | Selangor |

Untuk membukanya: bina semula frontend dengan skop dimatikan, contohnya `VITE_PROTOTYPE_SCOPE=off npm run stack:up` (atau tetapkan `VITE_PROTOTYPE_SCOPE=off` dalam `.env`).

## Akaun untuk uji mesej ralat

| E-mel | Hasil |
|---|---|
| `tidakaktif@demo.test` | "Akaun anda tidak aktif atau telah digantung. Sila hubungi pentadbir." |
| `digantung@demo.test` | "Akaun anda tidak aktif atau telah digantung. Sila hubungi pentadbir." |
| Mana-mana akaun + kata laluan salah | "E-mel/Nama pengguna atau kata laluan tidak sah." |

`sokongan@demo.test` bukan akaun log masuk. Ia cuma e-mel hubungan Sokongan yang dipaparkan dalam aplikasi.

## Nota stack

- Branch: `local/v2-full` = `be/integration-frontend` + `feature/v2-backend` (sama seperti UAT).
- Frontend ialah build production dalam Docker; selepas ubah kod frontend, jalankan `npm run stack:up` semula.
- Tutup: `npm run stack:down`.
- Elakkan menjalankan container projek lain (contohnya neoX-MPKL) serentak dengan build; PC pernah crash kerana kehabisan sumber.
