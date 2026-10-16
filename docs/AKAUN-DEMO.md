# Akaun Demo — Prototaip PrestasiPlus

Semua akaun ialah **akaun demo rekaan** dalam data tiruan (mock) prototaip. Ia tidak wujud di prestasiplus.my atau prestasiplus.cloud sebenar.

**Kata laluan semua akaun: `Demo1234`**

## Cara buka prototaip

### Pilihan 1: Pautan demo dalam talian (paling mudah)

Buka **https://claude.ai/artifact/5My2fSJfDXivvSUBmcVtbT** di telefon atau desktop.

- Pautan ini peribadi. Hanya pemilik akaun claude.ai boleh membukanya, kecuali dikongsi melalui menu Share.
- Pautan dikemas kini pada setiap checkpoint v2, dan pautannya kekal sama.
- Data yang anda ubah (jawapan, syiling dan sebagainya) disimpan dalam pelayar anda sahaja.
- Pautan dalam app guna format `#/`, contohnya `…#/login` atau `…#/dashboard`.

### Pilihan 2: Jalankan di komputer sendiri

1. Jalankan server tempatan: `npm run dev`.
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
| Pegawai JPN | `jpn@demo.test` | Pegawai negeri (dalam v2 peranan ini digabung dengan Pegawai PPD, D31) |
| Akaun tidak aktif | `tidakaktif@demo.test` | Untuk melihat mesej "akaun tidak aktif" |

## Pautan reset kata laluan demo

| Pautan | Hasil |
|---|---|
| `/password/reset/demo-reset-token?email=pelajar@demo.test` | Token sah: boleh tukar kata laluan dan log masuk |
| `/password/reset/demo-expired-token?email=pelajar@demo.test` | Token tamat tempoh: mesej ralat |

Token sah boleh digunakan sekali sahaja. Untuk mencuba lagi, set semula data demo: muat semula aplikasi dalam mod pembangunan, atau kosongkan data laman dalam pelayar.

## Halaman berguna

| Pautan | Kegunaan |
|---|---|
| `/__ds` | Galeri komponen design system v2 (tema staf dan murid, cerah dan gelap) |
| `/__dev/shell` | Pratonton bingkai menu setiap peranan (dev sahaja) |
| `/__dev/tokens` | Galeri warna dan token reka bentuk lama (dev sahaja) |
| `/__dev/feedback` | Galeri komponen mesej, amaran dan modal (dev sahaja) |

## Status semasa (16 Oktober 2026)

- **Prototaip v1 (rupa prestasiplus.my):** semua 59 baris matriks peranan (Murid, Guru, Admin Sekolah) siap 100% dan lulus QA. Lihat `docs/SCOPE-STATUS.md`.
- **v2 (sedang dibina, cabang `feature/v2-frontend`):**
  - Sudah siap: tema baharu, alat lint dan kontrak API.
  - Seterusnya: shell dua portal (Portal Pentadbiran dan Portal Pembelajaran).
  - Rupa baharu akan muncul di pautan demo yang sama bila skrin dipindahkan.
  - Kemajuan terperinci ada dalam `docs/TRACKER.md`.
