# Pelan 24 jam: Bank Soalan dan Bijak SPM

> **DITANGGUH, jangan ikut (2026-11-04 03:42 MYT).** Pengguna menghentikan pelan ini untuk berbincang dahulu. PRD pada cawangan `docs/r1-prd-devplan`, `docs/prd/r1/`, kini sedang disemak oleh pengguna.

Asas: tip `e34e0a52d` (BASE-237), dideploy di `uat.prestasiplus.cloud`. Disemak terhadap kod oleh B2; tiada arahan dalam pelan ini pernah dijalankan. 3 developer: D1, D2, D3. Sasaran: UAT sahaja.

Bukti: dua audit kod lawan keperluan (3 Nov), bacaan data UAT, dan laporan A4. Audit membaca kod; ia tidak menjalankannya. Ujian pelayar rantaian penuh masih berjalan, jadi senarai ini boleh bertambah.

## 1. Keadaan sebenar

Kod hampir lengkap, dan **tiada dua pangkalan data soalan**. Modul terasa rosak atas tiga sebab:

| Punca | Fakta |
|---|---|
| **Menu berganda** | 3 skrin bank: `/admin/questions`, `/admin/studio`, `/admin/spm/soalan`. 2 pembina kertas: `/admin/spm/kertas`, `/admin/studio/sets`. Import & Semakan dan Senarai Ekstrak ialah skrin yang sama. Semua memakai jadual soalan yang sama. |
| **Data kosong** | DSKP sudah dimuat (2,844 nod). Kontrak dan kertas di UAT: tiada yang sebenar. 85,504 soalan T4/T5 tiada unit DSKP atau bab, jadi tidak masuk kolam Jana Kertas. Ini ikut keputusan D80 dan D89. |
| **Bug fungsi** | Kira-kira 10 yang menghalang aliran. Senarai di bahagian 5. |

## 2. Maksud "siap" dalam 24 jam

Dua aliran ini berjalan di UAT, dari skrin, tanpa bantuan developer:

**Aliran A, soalan ke murid.** Admin muat naik atau tulis soalan → tag DSKP → hantar semakan → Terbitkan → muncul dalam Latih Tubi murid.

**Aliran B, kertas ke murid.** Admin cipta Kontrak → Sahkan → bina kertas (Pembina atau Jana) → Terbit → murid duduki → hantar → keputusan.

Ditambah: satu menu yang jelas, tanpa butang buntu pada kedua-dua aliran.

## 3. Tidak akan siap dalam 24 jam

Cakap awal supaya tiada kejutan:

- Cutover ke `prestasiplus.cloud`, termasuk migrasi data semula.
- Tag DSKP untuk 85,504 soalan lama. Tiada alat pukal, dan ia kerja kandungan.
- OCR sebenar (mock diterima, Q23).
- Skrin ibu bapa, penaja, PPD.
- 36 PR lama, termasuk kebanyakan kemas UI.
- Editor untuk soalan berstruktur selepas Terima (lihat T11).
- Soalan by Chapter berisi: semua soalan tiada bab, sama seperti V2 (D89). Admin perlu pilih bab satu per satu.

## 4. Keputusan, sebelum jam 1

Jika tiada jawapan pada jam 1, lalai digunakan.

| # | Soalan | Lalai | Kenapa |
|---|---|---|---|
| K1 | Skrin Bank Soalan utama? | `/admin/questions`. Studio dan Bank SPM keluar dari menu; laluan kekal | Paling lengkap untuk 406k: penapis, pukal, muat turun halaman |
| K2 | Pembina kertas utama? | `/admin/spm/kertas`. Set Builder keluar dari menu, tetapi dicapai dari Pembina kerana Jana ada di sana | Inilah yang E2E `admin-publish-http` buktikan. Sahkan dengan hasil Playwright |
| K3 | Soalan T1 hingga T3, dan 8 subjek SPM tanpa DSKP, boleh Terbitkan? | Boleh, tanpa tag DSKP (R1-U1) | Sekarang ia tersekat selama-lamanya |
| K4 | Satu kertas sebenar untuk bukti? | 3472/2 Matematik Tambahan K2 | Data paling lengkap (runbook 5.2) |
| K5 | Batch DS 19 kecacatan (REQ-A-083, `adb94601`, 29 fail)? | Merge pada jam 0, sebelum kerja lain | Merge kemudian akan berkonflik dengan semua orang |
| K6 | Siapa satu-satunya orang merge dan dispatch? | D1 | Dua orang merge pernah membatalkan CI |

**Input Playwright `.cloud` pada jam 1:** daripada Playwright di `.cloud`, satu jadual: skrin V2, langkah, dan skrin V3 yang menyamainya. Baca sahaja di production, tiada data sebenar atau nama orang dalam repo. Jika ia bercanggah dengan K1 atau K2, ikut V2.

## 5. Tugas

`m28` = `src/modules/m28-bijak-spm`, `api` = `apps/api/src/modules`. Saiz: S di bawah 1 jam, M 1 hingga 3 jam.

**Pemilikan fail, jangan bertindih.** D1: `src/shells/pentadbiran/`, `m04-question-bank`, `api/questions`, `m28/admin/intake/**`. D2: `m28/admin/papers`, `kontrak`, `kandungan`, `builder`, `api/exam`. D3: `m28/pages`, `m28/components`, `m05-practice`, `src/app/prototype-scope.ts`, `api/bijak`, `e2e/`. **`m28/server/http-admin.ts` dikongsi:** D2 merge T5 dahulu, kemudian D1 tambah T4.

### P0: wajib

| ID | Siapa | Tugas | Fail | Saiz | Siap apabila |
|---|---|---|---|---|---|
| T0 | D1 | Merge batch DS (K5) | `r1/a2-ds-batch` | S | CI `verify` hijau |
| T1 | D1 | Satu menu: BS-01 kekal; BS-08, KS-02, KS-14, KS-17 keluar; laluan lama kekal dibuka. **Pautan `PaperListPage.vue:103-109` ke Set Builder mesti kekal: Jana ada di sana** | `src/shells/pentadbiran/menu.ts`, `__tests__/menu.test.ts:47-60` | S | Admin nampak satu Bank Soalan, satu Pembina Kertas, dan masih boleh sampai ke Jana |
| T2 | D1 | Butang "Buka Studio" pada bar alat Bank, dan pautan baris ke editor Studio. Hanya Studio ada penapis tahun, negeri, kertas, jenis, lencana "Belum ditanda DSKP", dan tindakan baris draf dan arkib | `m04` senarai | S | Semua fungsi Studio boleh dicapai dari Bank |
| T3 | D1 | Gate Terbitkan dan Terima: unit dan SP tidak diwajibkan **hanya jika** `curriculum_nodes` ada baris, tetapi tiada untuk subjek dan tahap itu (K3). Syarat "ada baris" supaya pangkalan data tanpa DSKP tidak mematikan gate. Kertas dan aras pemikiran T4/T5 kekal wajib | `api/questions/publish-gate.ts:30-31`, `gate-data.ts`, `workflow/lifecycle/gates.ts:49,63`, `m28/admin/intake/domain/validation.ts:81-82` | M | Soalan T2 boleh Terima dan Terbitkan; T4 MATH tanpa tag masih ditolak; soalan tanpa unit tetap tidak masuk kertas |
| T4 | D1 | Soalan bertanda pendua boleh diselesaikan: papar padanan, butang Bukan pendua dan Pendua. Route ada (`intake-workflow.controller.ts:157`); klien, jenis dan mock belum | `IntakeReviewPage.vue`, `m28/server/http-admin.ts`, `server/types` | M, hujung atas | Soalan bertanda boleh keluar dari Draf |
| T5 | D2 | Dropdown subjek guna `GET /api/admin/bijak/subjects`, bukan senarai Kontrak | `m28/server/http-admin.ts:355-370` | S | Muat Naik ada subjek walaupun 0 Kontrak |
| T6 | D2 | Butang buntu: pautan ke `/admin/studio/questions/:id/sunting`. Termasuk Betulkan dan Hantar Semula dalam Baris Gilir Semakan | `m28/admin/papers/BankPage.vue:381`, `kandungan/pages/LaneDatabankPage.vue:105,115`, `ReviewItemPage.vue:239,257` | S | Tiada "belum tersedia dalam demo" pada menu yang kekal |
| T7 | D2 | Kertas draf tersekat selepas Kontrak versi baharu disahkan: terima versi disahkan terkini **hanya jika `structure_hash` sama**, atau semak kesesuaian terhadap versi itu | `api/exam/builder/builder.service.ts:803-807` | M | Nota diedit lalu Sahkan v2: Terbit lulus. Struktur berubah: masih ditolak |
| T8 | D3 | Murid nampak "Spec, ujian sahaja" selepas Kontrak diedit: pulangkan versi yang sedang berkhidmat | `api/bijak/papers/papers.service.ts:130-148`, `papers.repository.ts:102-106`, spec `b09a-contracts` | M | Murid tidak nampak Spec, dan kod serta tempoh ikut versi berkhidmat |
| T9 | D3 | Laporan Soalan Saya untuk murid (AC-R1-18.2). Sahkan menu Pembelajaran memaparkannya (`user-nav.ts:436`) | `prototype-scope.ts:128-179`, `__tests__/prototype-scope.test.ts:115` | S | Murid buka dari menu dan nampak status laporan |
| T10 | D3 | **Mula dahulu.** Spec `@api` Aliran B penuh: Kontrak, Sahkan, Jana atau Pembina, Terbit, duduki, keputusan. Mula dari `r1/b4-kontrak-http-spec` @ `01eeb0ed` (Baharu hingga Sahkan sudah ada). Jana hingga keputusan masih baharu dan belum pernah dibuktikan melalui UI | `e2e/` | L | Lulus 3 lebar; kegagalan terus jadi tugas P0 |

### P1: jika P0 siap

| ID | Siapa | Tugas | Fail |
|---|---|---|---|
| T11 | D1 | Amaran sebelum Terima jika aras pemikiran kosong: selepas Terima tiada editor untuk soalan berstruktur | `m28/admin/intake/domain/validation.ts` |
| T12 | D1 | Penapis Source dan compliance yang sentiasa kosong: buang pilihan | `m04` `lib/question-list.ts` |
| T13 | D2 | "Lihat soalan" Pratonton Kolam ke senarai bertapis | `kontrak/domain/pool.ts:60`, tujuan T1 |
| T14 | D2 | Mod Jawapan `essay_choice` dalam editor Kontrak | `kontrak/components/SectionEditor.vue:37-46` |
| T15 | D3 | Admin uji Kontrak Spec melalui Mod Pelajar. Spec tidak boleh kembali kepada murid sebenar (T8) | `api/bijak/papers/papers.controller.ts:46`, `papers.service.ts`, `BijakHubPage.vue:106` |
| T16 | D3 | Baki Koin dan Mata pada keputusan Mod Latihan | `api/bijak/attempts/marking.ts:212` |

### Data dan kandungan: manusia, bukan kod

| ID | Siapa | Tugas | Bila |
|---|---|---|---|
| C1 | Pemilik kandungan | Kontrak 3472/2, Sahkan mengikut `r1-k1-blueprint-evidence.md`. Baris tempoh belum disahkan | Selepas batch 1 |
| C2 | Pemilik kandungan | Cukup soalan bertag untuk satu kertas 3472/2. **Bilangan bergantung pada Kontrak**; tanpa ini Jana menolak dengan SHORTAGE | Selepas batch 1 |
| C3 | Pemilik | E-mel dan telefon sokongan untuk `/panduan` | Bila-bila |

## 6. Jadual

| Jam | Kerja |
|---|---|
| 0 hingga 1 | K1 hingga K6; T0; input Playwright; D3 mula T10 |
| 1 hingga 8 | P0 serentak, cawangan sendiri, ujian merah dahulu |
| 8 hingga 10 | Semakan silang; **Batch 1**: D1 merge sekali, satu CI (kira-kira 40 minit), deploy UAT |
| 10 hingga 14 | Uji Aliran A dan B di UAT; betulkan yang gagal; C1 dan C2 bermula |
| 14 hingga 18 | P1 dan pembaikan; **Batch 2** pada jam 18 |
| 18 hingga 22 | Kertas 3472/2 sebenar; uji semula kedua-dua aliran, 3 lebar |
| 22 hingga 24 | Beku kod; laporan; senarai had untuk pemilik |

Jika jam 14 P0 belum siap, buang P1 sepenuhnya.

## 7. Peraturan kerja

1. Cawangan dari tip semasa, `r1/<id>-<ringkas>`. Tiada push terus ke `feature/v3-bijak-r1`.
2. Bug ID dan API sebenar: uji dengan `http` mode, bukan mock. Mock pernah menyorok kuiz bab, bilik dan Jutawan.
3. Binaan dengan `VITE_PROTOTYPE_SCOPE=on`. Laluan yang murid perlukan mesti diuji pada skop itu.
4. Satu semakan silang setiap unit, oleh developer lain. Kod di bawah `eslint/`, `scripts/` atau `config/`: larikan `npm run lint` dan ratchet penuh.
5. Satu dispatch CI satu masa, selalu dengan `api_ref` = SHA itu. Dispatch baharu membatalkan yang berjalan.
6. Tiada migrasi baharu kecuali terpaksa; ia perlu backup dan menambah risiko.
7. Deploy UAT ikut `docs/ops/r1-uat-deploy.md`, manusia yang jalankan, melainkan pemilik membenarkan setiap kali.
8. Jangan sentuh `prestasiplus.cloud`.

## 8. Risiko

| Risiko | Tindakan |
|---|---|
| Aliran B gagal melalui UI: belum pernah dibuktikan | T10 dimulakan pada jam 0 supaya masalah muncul awal |
| Kolam tidak cukup untuk Jana | Guna Pembina manual untuk bukti; catat Jana sebagai bergantung kandungan |
| Menu dibuang, ada fungsi hilang | Laluan lama kekal; T2 |
| Keputusan K terlewat | Lalai berkuat kuasa pada jam 1 |
| CI 40 minit, gagal lewat | Larikan unit dan E2E berkaitan secara tempatan sebelum batch |
