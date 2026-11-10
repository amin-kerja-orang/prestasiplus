# Kesediaan V3 untuk UAT dan Migrasi DB V2 — 10 Nov 2026

**Skop:** dua matlamat PO pagi 10 Nov: (1) deploy V3 lokal ke `uat.prestasiplus.cloud`, (2) clone DB V2 (prestasiplus.cloud) ke V3.
**Kaedah:** tiga analisis baca sahaja (ciri, migrasi, deploy) + semakan server UAT (baca sahaja) + `docs/qa/gap-analysis-2026-11-08/DATA-GAP.md`. Tiada apa diubah di server.

## 1. Ringkasan

| Bahagian | Kesediaan | Status |
|---|---|---|
| Ciri / fungsi V3 (berbanding skop R1) | **~70%** (julat 63–77%) | Portal murid, guru, admin sekolah hampir siap; Admin Pusat dan Bijak SPM paling banyak jurang |
| Deploy ke UAT (teknikal) | **~60%** | Boleh deploy bersyarat: build hijau, tapi 60 migrasi belum diraptai pada data sebenar |
| Clone / migrasi DB V2 → V3 | **~50%** | ETL wujud dan sudah dijalankan sekali (snapshot 29 Okt), tetapi skema berubah banyak sejak itu dan banyak data V2 tidak dimuat |
| **Keseluruhan** | **~60%** | Deploy boleh dibuat hari ini selepas raptai; clone DB penuh tidak boleh siap 100% hari ini |

**Fakta penting:** UAT **sudah** berisi data V2 (snapshot 29 Okt, ETL run 3–8): ~7,005 pengguna, 10,208 sekolah, ~406k soalan MCQ. Jadi matlamat 2 sebenarnya = **muat semula data V2 terkini (delta sejak 29 Okt) + tutup jurang data** yang ditinggal kali pertama, bukan clone dari kosong.

## 2. Keadaan UAT sekarang (baca sahaja, 10 Nov)

- Kod: `e34e0a52d` (3 Nov). Bekas `api`, `frontend`, `edge`, `db` (Postgres 16) semuanya sihat.
- Migrasi Prisma: 51 diguna, terakhir `0110_reference_image_tokens`.
- Cakera: 23G / 193G (12%).
- Backup: dump malam terbaru 10 Nov 02:20 (~166 MB), dump mingguan, arkib fail 9 Nov, WAL. Drill pemulihan terakhir dibuktikan 2 Nov sahaja.
- Jarak dengan lokal: **631 commit** (128 belum di-push), **60 migrasi tertunggak** (0120 hingga 0264).

## 3. Kesediaan deploy (~60%)

**Sudah hijau:**
- Typecheck frontend dan backend: lulus. Build produksi frontend: lulus. `prisma validate`: lulus.
- Tiada DDL yang memusnahkan (tiada DROP TABLE / DROP COLUMN / TRUNCATE / DELETE).
- Tiada env wajib yang tiada di UAT (hanya `OCR_LANG_DIR`, perlu jika OCR dihidupkan).
- `deploy.sh` tidak menjalankan seed demo; ia menolak bendera seed demo.

**Belum hijau / risiko:**

| # | Risiko | Butiran |
|---|---|---|
| D1 | 60 migrasi belum diraptai pada data sebenar | `0188` kunci penuh `practice_answers` (UPDATE + SET NOT NULL), `0203` tukar nama kelas guru berganda kepada "Nama (2)" (perubahan data yang nampak), `0127`/`0130` sentuh ~450k soalan (mungkin lambat), backfill pada `0229`, `0185`, `0180`, `0162`, `0234`. Migrasi tidak boleh diundur di tempat; pulih hanya dari dump. |
| D2 | Ujian backend belum lengkap | 13 fail gagal semasa larian dihentikan: ~8 `test/migration/*` (disyaki isu Windows), `test/support/tickets.spec` 24/34 gagal, `test/conformance/run.spec` 21/430 gagal (tiket, `/rph`, semakan esei). Mungkin regresi sebenar atau flaky; perlu larian berasingan. |
| D3 | Runbook basi | `docs/ops/r1-uat-deploy.md` (3 Nov) masih sebut migrasi 0092–0110; belum pernah dijalankan pada server sebenar. |
| D4 | 128 commit belum di-push | `deploy.sh` checkout SHA dari `origin`. Push perlu kelulusan PO. |
| D5 | Keputusan tetapan | `OCR_ENGINE` (UAT `none`, contoh baharu `tesseract`); had muat naik `PP_UPLOAD_FILES_MB` 22→32, `PP_UPLOAD_BIG_MB` 256→336. |
| D6 | Drill pemulihan | Terakhir dibuktikan 2 Nov; pemasa drill tiada pencetus seterusnya. |
| D7 | Downtime | Semasa langkah migrasi; UAT ada murid sebenar. |

## 4. Kesediaan clone / migrasi DB V2 (~50%)

**Ada:** saluran ETL lengkap di `apps/api/src/migration/` (dump → staging → profile → `migrate:all` dry-run → `--apply` → `migrate:verify`, `migrate:delta`, `migrate:rollback`), jadual kawalan `etl_runs` / `etl_id_map` / `etl_recon` / `etl_reject`, kata laluan Laravel bcrypt `$2y$` disahkan lalu di-hash semula ke argon2 semasa log masuk, ID V2 disimpan sebagai `legacy_id`, upsert idempotent. Docs: `docs/architecture/v2-data-migration.md`, `v2-migration-decisions.md`, `v2-migration-runbook.md`, `docs/ops/cloud-dump-procedure.md`, `docs/ops/r1-go-live-runsheet.md`.

**Masalah:**

| # | Masalah | Butiran |
|---|---|---|
| M1 | ETL ketinggalan skema | Terakhir dibuktikan pada `cb7332d0b` (30 Okt). Sejak itu ~71 fail migrasi Prisma baharu dan 31 fail ETL berubah. Langkah battle/permainan nampak basi. |
| M2 | Bijak SPM kosong | V2: 60 set ramalan, 175 `exam_papers`, 36 blueprint. UAT: 0 kertas boleh guna. ETL sengaja tidak memuat. |
| M3 | Soalan rajah/stimulus tiada gambar | V2: 1,931 `stimuli`, 408 soalan diluluskan bergambar. UAT: 0 stimulus, 0 gambar. Perlu akses storan fail `.cloud` (item K3). |
| M4 | Soalan subjektif/berstruktur tiada | V2: 4,061 `structured_questions`, 10,296 sub-soalan, 2,015 subjektif. UAT: semua MCQ sahaja. |
| M5 | Soalan diarkib/draf dan yang ditolak | 43,165 diarkib + 155 draf tidak dimuat (sengaja); 1,801 diluluskan ditolak ETL (`DUPLICATE_KEY`, `INVALID_VALUE`). |
| M6 | DSKP tiada pada sumber | V2 sendiri tidak memetakan soalan ke bab/topik (0 daripada 451,518). Ini kerja **penandaan**, bukan migrasi. |
| M7 | Kandungan ditolak | Artikel 92→0, nota 10→0, tiket 3→0 (ORPHAN_PARENT / INVALID_VALUE). |
| M8 | Gamifikasi | `gifts` 50 dan tebusan 7 tidak dimuat (Q8, nilai belum diputuskan). |
| M9 | Kelas dan aktiviti | 20 daripada 33 kelas guru tidak layak; 227 sesi, 1,965 jawapan, 527 dompet yatim ditolak. |
| M10 | Peranan dan tahap | Peranan `agent` (7) dan `jpn_officer` (1) tiada di V3; 68% murid tiada `grade` (V2 hanya ada teks bebas `kelas`). Headcount (12) tiada kad ETL. |
| M11 | Gabung atau ganti | Data UAT selepas 29 Okt (kata laluan ditukar, aktiviti murid) akan hilang jika UAT dipulihkan ke snapshot `pre_etl` lalu dimuat semula. Perlu keputusan PO. |
| M12 | V2 masih hidup | Log masuk terakhir 7 Nov; perlu `migrate:delta` sebelum cutover. |

## 5. Kesediaan ciri (~70%)

| Kawasan | % | Jurang utama |
|---|---|---|
| Murid | ~87 | Remedial tidak menjana (8 Nov), Heatmap kosong, kad "Pakej SPM Aktif", Kedudukan, data ujian kelihatan |
| Guru | ~88 | Misi Harian sudah dibina selepas 8 Nov (belum diuji semula) |
| Admin Sekolah | ~82 | Kiraan bercanggah (murid 20 lawan 17, guru 3 lawan 4, dua jumlah Amaran Awal) |
| Admin Pusat | ~55 | Skrin admin Gamifikasi tiada laluan; Hadiah/Permainan dibina tapi tiada pautan menu |
| Bijak SPM / pengambilan soalan | ~70 | Kecacatan G-01 hingga G-05 belum disahkan semula; pengekstrak PDF masih olok-olok |
| Permainan / Gamifikasi | ~60 | Sisi murid pada API sebenar; sisi admin kebanyakannya tiada |
| Kandungan | ~75 | Laluan admin ada; data kosong (lihat M7) |
| Laporan / Analitik | ~65 | Paparan Admin Pusat dalam kumpulan "Ditangguhkan" |

Pendawaian: 317 daripada 331 laluan `/api` di frontend ada laluan backend (~96%). 14 tanpa backend kebanyakannya milik skrin tersorok/ditangguhkan.

**Di luar skop R1 (tidak dikira):** Cikgu Alesa dan semua AI (D73), Keluarga Angkat/Penajaan/Anak Angkat (D74, D102), Darjah 1–6 (D72), portal Ibu Bapa, Kombo, Notifikasi, Psikometrik, Wellbeing, Billing/Invois/Dunning, Log Audit, Chatbot, skrin admin Kotak Misteri/Tournament/Jemput Ibu Bapa (D118-4), PPD/JPN, Duta, Cita-Cita.

## 6. Pelan untuk capai 100%

Urutan: **deploy kod dahulu, kemudian data.** ETL mesti dijalankan pada skema terkini, jadi migrasi 0120–0264 perlu ada di UAT dulu.

### Fasa A — Deploy selamat (anggaran: separuh hari; boleh siap hari ini)

| # | Kerja | Siapa | Selesai bila |
|---|---|---|---|
| A1 | Larian semula `tickets.spec` dan `conformance/run.spec` secara berasingan; baiki jika regresi sebenar | backend-developer | Kedua-dua hijau |
| A2 | Raptai 60 migrasi pada salinan dump UAT terbaru (Postgres 16 lokal); catat masa `0188`, `0203`, `0127`, `0130`; semak kelas yang akan ditukar nama oleh `0203` | devops-engineer | Semua migrasi lulus, masa diketahui, senarai kelas dilaporkan |
| A3 | Kemas kini `docs/ops/r1-uat-deploy.md` (julat migrasi, env baharu, langkah tanpa seed) | devops-engineer | Runbook sepadan dengan HEAD |
| A4 | Keputusan PO: `OCR_ENGINE`, had muat naik, tetingkap deploy | PO | Dijawab |
| A5 | Push `feature/v3-bijak-r1` ke origin | Lead, dengan kelulusan PO | SHA ada di origin |
| A6 | Backup `pre-deploy` + `pg_restore --list` + sahkan drill pemulihan | devops-engineer | Dump disahkan |
| A7 | Deploy (`deploy.sh`, tanpa `--seed-reference`), ujian asap (log masuk setiap peranan, latihan, admin) | devops-engineer, qa-engineer | `/api` sihat, ujian asap lulus |

### Fasa B — Data V2 (anggaran: 2–4 hari kerja; tidak 100% hari ini)

| # | Kerja | Selesai bila |
|---|---|---|
| B1 | Rebase ETL ke skema HEAD: `be:lint:migration`, `test/migration/*`, kemas kini langkah battle/permainan; raptai sintetik saiz `medium` | Ujian ETL hijau, raptai lulus |
| B2 | Keputusan PO: **delta di atas UAT** (disyorkan: kekalkan data murid sejak 29 Okt) atau ganti penuh | Dijawab |
| B3 | Dump `.cloud` baharu (baca sahaja, ikut `cloud-dump-procedure.md`), `staging:load` + `staging:profile` lokal; semak enum tidak dikenali, yatim, pendua | Profil disemak |
| B4 | Tutup jurang data yang mudah: artikel/nota/tiket (M7), hadiah (M8, perlu nilai Q8), kelas tidak layak dan yatim (M9), peranan `agent`/`jpn_officer` dan terbitan `grade` dari teks `kelas` (M10), 1,801 soalan ditolak (M5), headcount | Recon setiap entiti tanpa tolakan yang tidak dijelaskan |
| B5 | Bank soalan penuh: stimulus + gambar rajah (M3, perlu akses storan `.cloud`), soalan berstruktur/subjektif (M4), keputusan PO tentang 43k diarkib | Soalan rajah bergambar, subjektif boleh dipapar dan dibaiki dalam skrin V3 (Regroup, Soalan tanpa Bab, Audit Rajah) |
| B6 | Bijak SPM: muat 60 set ramalan, 175 kertas, 36 blueprint (M2), atau keputusan PO untuk bina semula | Bijak SPM ada kertas boleh guna |
| B7 | Dry-run `migrate:all` / `migrate:delta` pada salinan UAT lokal, `migrate:verify`, larian kedua idempotent, ujian asap | Verify lulus |
| B8 | Backup UAT, jalankan di UAT, verify | Verify lulus di UAT |

**Di luar migrasi:** penandaan DSKP soalan (M6) ialah projek berasingan (AI atau manual) kerana V2 tiada data itu.

### Fasa C — Ciri ke 100% (anggaran: 3–5 hari kerja)

| # | Kerja |
|---|---|
| C1 | Pautan menu Hadiah/Tebusan dan Permainan (PG-06, PG-11) |
| C2 | UI admin Gamifikasi: Overview, Tier Config dan Cabaran (baca sahaja, D118-3), Pelajar, Transaksi, Kawalan Reward (backend sudah ada) |
| C3 | Sahkan dan baiki G-01 hingga G-05 (Jana set terkunci, lajur DSKP CSV, stimulus hilang semasa simpan draf, Topik tidak ditapis ikut Bab); pengekstrak PDF sebenar (bergantung keputusan OCR) |
| C4 | Kiraan bercanggah admin sekolah dan Amaran Awal |
| C5 | Remedial, Heatmap, kad "Pakej SPM Aktif", Kedudukan |
| C6 | 14 laluan frontend tanpa backend: buang atau bina |
| C7 | Buang data ujian yang kelihatan di UAT (QA-GAP, E2E fixture, "Contoh:", "Demo") — senarai disemak PO dulu |
| C8 | Kemas kini spec E2E yang masih guna tajuk lama (m02, m03, m04, m09, m12, m07, m27, m15) |
| C9 | Audit semula penuh selepas Fasa A (qa-engineer, setiap peranan, 375/768/1280) |

## 7. Keputusan PO

**Diputuskan 10 Nov:**
- **Urutan:** capai 100% (Fasa A, B, C) **sebelum** sebarang push atau deploy ke UAT.
- **Migrasi data: ganti penuh.** DB UAT dibina semula dari kosong (migrasi hingga HEAD) dan diisi dari dump V2 terbaru. Data yang dicipta di UAT sejak 29 Okt (kata laluan ditukar, aktiviti) tidak dibawa. B2 selesai; B7 dan B8 dijalankan sebagai muatan penuh, bukan delta (delta hanya untuk perubahan V2 antara dump dan cutover).
- **`OCR_ENGINE=tesseract`** di UAT; `OCR_LANG_DIR` perlu ditetapkan (D5).
- **Had muat naik baharu diterima:** `PP_UPLOAD_FILES_MB=32`, `PP_UPLOAD_BIG_MB=336` (D5).

**Masih terbuka:**
1. Lulus push branch dan tetingkap deploy UAT (selepas 100%).
2. Skop bank soalan: diarkib (43k), subjektif/berstruktur, set SPM V2 (B5, B6).
3. Nilai hadiah V2 (Q8) untuk memuat `gifts` (B4).
