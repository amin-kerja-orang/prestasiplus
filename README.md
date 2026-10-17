# PrestasiPlus App

> **English summary.** PrestasiPlus App is a Vue 3 + Vite + TypeScript + Tailwind v4 front-end prototype (mock data,
> no backend) that rebuilds the education platform prestasiplus.my module by module (M01–M27; all 59 role-matrix rows
> are at G5 READY). **v2 status:** the project is now evolving into a new system (decisions D28–D32): the frontend is
> re-themed on Nuxt UI (light + dark), there are two portals (Portal Pentadbiran and Portal Pembelajaran), and a
> NestJS + PostgreSQL backend will follow, with data migrated from prestasiplus.cloud. Current phase: v2 G2 design.
> AI agents and new contributors: start with [AGENTS.md](AGENTS.md), then the docs index [docs/README.md](docs/README.md)
> and [docs/TRACKER.md](docs/TRACKER.md). The setup commands below are the same for everyone.

Prototaip front-end (data olok-olok) bagi pembinaan semula prestasiplus.my, modul demi modul (M01–M27).
Stack: Vue 3 + Vite + TypeScript + Tailwind CSS v4 + Lucide (`@lucide/vue`). Dokumentasi seni bina di

Container (Docker): `docker compose up -d` (http://localhost:5192); lihat `docs/ops/containers.md`.
`docs/architecture/overview.md`, keputusan di `docs/adr/`, dan status projek di `docs/TRACKER.md`.

## Mula menggunakan

### Keperluan

- Node.js `^22.22.2 || ^24.15.0 || >=26.0.0` (sama dengan julat jsdom 30 untuk ujian unit; lihat
  `.nvmrc`). npm 10.
- Pelayar Chromium untuk ujian E2E (dipasang oleh Playwright, lihat di bawah).

### Pasang

```bash
npm install
npx playwright install chromium   # sekali sahaja, untuk ujian E2E
```

### Jalankan

```bash
npm run dev        # pelayan pembangunan (mod development, data olok-olok + test hooks)
npm run build      # binaan demo (mod demo) ke folder dist/
npm run preview    # hidangkan binaan dari dist/
```

Buka URL yang dipaparkan oleh `npm run dev` (biasanya http://localhost:5173).

### Uji dan semak

```bash
npm run lint       # ESLint (termasuk peraturan sempadan modul)
npm run typecheck  # vue-tsc, TypeScript strict
npm run test       # Vitest projek unit (ujian unit dan komponen; tanpa ujian prestasi)
npm run test:perf  # Vitest projek perf: ujian prestasi (*.perf.test.ts), bersiri, pada mesin lapang
npm run test:e2e   # Playwright pada 3 projek: mobile 375×812, tablet 768×1024, desktop 1280×800
npm run test:e2e:observed   # E2E tanpa ujian bertanda @provisional
npm run test:e2e:module -- m01-authentication   # E2E satu modul sahaja (e2e/<slug>/)
npm run format     # Prettier (tulis semula fail)
npm run verify     # lint + typecheck + test + build (bukti gerbang G3)
npm run check:trace          # semak ID E2E SRS lawan tajuk ujian (rangka; dilengkapkan oleh F-22)
```

**Ujian prestasi (`npm run test:perf`).** Ujian prestasi tidak termasuk dalam `npm run test` dan
`npm run verify`. Jalankan `npm run test:perf` pada mesin yang lapang: ia **wajib pada G4 untuk
tugasan yang sensitif prestasi, dan semasa QA**. Setiap kes dipasangkan dengan "lantai" masa mesin
pada saat yang sama (`src/mock/dataset/testing/perf-calibration.ts`). Jika lebih 25 % gerbang bajet
dilangkau kerana mesin terlalu sibuk, larian gagal dengan mesej "machine too loaded — rerun
`npm run test:perf` on a quiet machine". Jalankan semula apabila mesin lapang.

`test:e2e:module` berfungsi di Windows, macOS dan Linux. Slug modul boleh diberi sebagai argumen
(seperti di atas) atau melalui pemboleh ubah persekitaran `MODULE` (contoh
`MODULE=m01-authentication npm run test:e2e:module`). Argumen Playwright tambahan diletakkan selepas
slug, contoh `npm run test:e2e:module -- m01-authentication --project=mobile`.

Ujian E2E dibina ke folder `dist-e2e/` (`npm run build:e2e`, dijalankan secara automatik oleh
Playwright), berasingan daripada binaan demo dalam `dist/`, supaya `dist/` tidak pernah mengandungi
test hooks. Pengawal binaan demo boleh disemak pada folder lain:
`node scripts/check-demo-bundle.mjs dist-e2e`.

Ujian E2E yang meliputi tingkah laku yang belum diperhatikan di laman sebenar diberi tag `@provisional`
dalam tajuk ujian. Tajuk ujian bermula dengan ID SRS (contoh `E2E-M01-03 ...`) dan membawa tag modul
(contoh `@m01`).

### Akaun demo

Semua akaun menggunakan kata laluan demo **`Demo1234`** (fixture M01 SRS). Akaun ini tersedia apabila
lapisan data olok-olok (tugasan F-11) siap.

| id  | E-mel                  | Peranan                  | Tahap        | Sekolah                                 |
| --- | ---------------------- | ------------------------ | ------------ | --------------------------------------- |
| 1   | admin@demo.test        | admin                    | 4 (Darjah 4) | SK Demo (Johor), id 900002              |
| 2   | pelajar@demo.test      | student                  | 10 (Ting. 4) | SMK DEMO (Selangor, BEA4001), id 900001 |
| 3   | pelajar2@demo.test     | student (tiada aktiviti) | 5 (Darjah 5) | —                                       |
| 4   | pelajarmaju@demo.test  | student (maju)           | 1 (Darjah 1) | SK Demo (Johor)                         |
| 5   | guru@demo.test         | teacher                  | —            | SMK DEMO                                |
| 6   | ibubapa@demo.test      | parent                   | —            | —                                       |
| 7   | penaja@demo.test       | sponsor                  | —            | —                                       |
| 8   | adminsekolah@demo.test | school_admin             | —            | SMK DEMO                                |
| 9   | ppd@demo.test          | ppd_officer              | —            | —                                       |
| 10  | jpn@demo.test          | jpn_officer              | —            | —                                       |
| 11  | tidakaktif@demo.test   | student (tidak aktif)    | 7 (Ting. 1)  | —                                       |

Akaun 11 sengaja tidak aktif: log masuk dengannya memaparkan mesej akaun tidak aktif.
