# Pelan Pelaksanaan dan Tracker — V3 100% Sedia untuk UAT

**Dicipta:** 10 Nov 2026. **Asas:** [r1-kesediaan-uat-2026-11-10.md](r1-kesediaan-uat-2026-11-10.md) (kesediaan ~60%).
**Matlamat:** V3 lokal 100% sedia, kemudian (dengan kelulusan PO) deploy ke `uat.prestasiplus.cloud` dan isi DB UAT dengan data V2 terkini (ganti penuh).
**Peraturan:** tiada push atau sentuhan pada UAT sebelum Gerbang G-100 lulus dan PO meluluskan Fasa 5. V2 produksi dan Pios baca sahaja. Kelayakan (credentials) tidak pernah disalin ke repo, dokumen atau mesej.

## 1. Definisi "100% sedia"

Setiap baris mesti lulus dengan bukti sebenar (output ujian, laporan recon, tangkapan skrin):

| # | Kriteria | Bukti |
|---|---|---|
| K1 | Typecheck frontend dan backend, build produksi, `prisma validate` hijau | Log arahan |
| K2 | Ujian unit frontend dan backend hijau (kecuali kegagalan lama yang disenaraikan dan diterangkan) | Log `vitest` |
| K3 | DB kosong → migrasi hingga HEAD → seed rujukan → ETL penuh → `migrate:verify` lulus; larian kedua idempotent (0 perubahan) | Laporan recon, `etl_reject` dengan setiap sebab dijelaskan |
| K4 | Setiap kumpulan data V2 dalam skop ada dalam V3 dan boleh dipapar serta dibaiki dalam satu skrin V3 | Jadual recon V2 lawan V3 |
| K5 | Semua item ciri Fasa 3 siap; tiada laluan menu mati; tiada laluan frontend tanpa backend dalam skop | Peta kanonik `--check`, audit |
| K6 | Audit penuh setiap peranan (murid, guru, admin sekolah, Admin Pusat, Mod Pelajar) pada 375, 768, 1280 atas data V2 sebenar (salinan lokal): tiada Blocker/Major | Laporan QA |
| K7 | Suite E2E hijau | Log Playwright |
| K8 | Code review Approve dan semakan keselamatan lulus untuk ETL, skrip deploy dan pengendalian PII | Laporan |
| K9 | Runbook cutover dikemas kini dan diraptai hujung ke hujung pada tindanan seperti UAT | Log raptai dengan masa setiap langkah |

## 2. Keputusan

| ID | Keputusan | Status |
|---|---|---|
| KP-1 | 100% dahulu, kemudian deploy | Diputuskan 10 Nov |
| KP-2 | Data V2: ganti penuh (DB UAT dibina semula) | Diputuskan 10 Nov |
| KP-3 | `OCR_ENGINE=tesseract` di UAT | Diputuskan 10 Nov |
| KP-4 | Had muat naik 32 MB / 336 MB | Diputuskan 10 Nov |
| KP-5 | Skop bank soalan: 43,165 diarkib + 155 draf; soalan berstruktur/subjektif; set SPM V2 | Diputuskan 10 Nov: bawa semua yang tidak dipadam (diarkib dan draf kekal statusnya); V3 menyambung pengurusan V2 |
| KP-6 | Nilai hadiah V2 (Q8) untuk `gifts` dan tebusan | Ditutup: guna nilai V2 sendiri (gifts.price_token dan lain-lain), tiada input PO |
| KP-7 | Kata laluan lalai akaun roster (`PP_MIGRATE_ROSTER_DEFAULT_HASHES`): paksa tukar kata laluan atau kekal | Diputuskan 10 Nov: kekal, tiada paksaan tukar kata laluan |
| KP-8 | V2 selepas cutover: dibekukan, diubah hala, atau terus hidup (perubahan selepas dump hilang) | Di luar skop (PO): peralihan V2 bukan tugas ini; sasaran ialah UAT V3 dengan DB V2 diklon |
| KP-9 | Notis downtime kepada pengguna UAT dan tetingkap deploy | **Terbuka** (Fasa 5) |
| KP-10 | Lulus push branch ke origin | **Terbuka** (Fasa 5) |
| KP-11 | Soalan rajah/berstimulus dalam latihan murid ikut Bab (T-C13): bina sekarang atau tangguh | Bina: V2 papar gambar soalan dalam latihan murid (latih-tubi/quiz.blade.php), jadi ini pariti V2 |

## 3. Fasa dan jadual

| Fasa | Isi | Anggaran | Bergantung |
|---|---|---|---|
| F1 Asas | Ujian backend, laluan DB kosong, ETL rebase, ciri mudah | Hari 1–2 | — |
| F2 Data dan ciri | Dump V2, profil, tutup jurang data, ciri besar | Hari 2–5 | F1, KP-5/6/7 |
| F3 Raptai penuh | Tindanan seperti UAT: DB kosong + migrasi + seed + ETL + aplikasi | Hari 6 | F2 |
| F4 Gerbang G-100 | Audit QA, E2E, code review, keselamatan | Hari 7 | F3 |
| F5 Pelepasan UAT | Push, backup, deploy, bina semula DB, ETL, ujian asap, sign-off | Hari 8 | G-100 + KP-8/9/10 |

Laluan selari: Aliran A (deploy) dan Aliran C (ciri) berjalan serentak dengan Aliran B (data). Maksimum tiga lorong browser untuk QA.

## 4. Tracker

Status: ⬜ belum · 🔄 sedang · ✅ siap (dengan bukti) · ⛔ tersekat.

### Aliran A — Deploy dan infrastruktur

| ID | Tugas | Pemilik | Bergantung | Anggaran (hari) | Status | Bukti |
|---|---|---|---|---|---|---|
| T-A1 | Larian berasingan `test/support/tickets.spec.ts` dan `test/conformance/run.spec.ts`; baiki regresi sebenar (tiket, `/rph`, semakan esei) | backend-developer | — | 0.5 | ✅ | dae94516f: tickets 34/34, conformance 430/430 (bendera ciri + peranan smoke) |
| T-A2 | Larian penuh ujian backend dalam bekas Linux (elak artifak Windows pada `test/migration/*`, `answer-store-writers`); senaraikan setiap kegagalan tinggal dengan punca | devops-engineer | — | 0.5 | 🔄 | |
| T-A3 | Laluan DB kosong: Postgres 16 baharu → `prisma migrate deploy` 0001 hingga HEAD → `be:db:seed` rujukan (tanpa demo); sahkan kurikulum/DSKP (2,844 nod, 1,394 deskriptor TP), subjek, pakej sekolah tepat dan tiada kandungan demo/ujian | devops-engineer | — | 0.5 | 🔄 | |
| T-A4 | Prosedur "bina semula DB" berpengawal untuk UAT (backup → henti api → drop/create DB → migrate → seed rujukan → ETL → mula api), dengan pengesahan nama DB dan bendera eksplisit; raptai lokal | devops-engineer | T-A3 | 1 | ⬜ | |
| T-A5 | OCR: imej api dengan tessdata, `OCR_ENGINE=tesseract`, `OCR_LANG_DIR`; ujian pengekstrakan satu PDF contoh dalam bekas | devops-engineer | — | 0.5 | 🔄 | |
| T-A6 | Env UAT: senarai nilai baharu (had muat naik 32/336, OCR, `PP_RELEASE_SHA`); tiada rahsia dalam repo | devops-engineer | T-A5 | 0.25 | 🔄 | |
| T-A7 | Kemas kini `docs/ops/r1-uat-deploy.md` dan tulis runsheet cutover ganti penuh (langkah, masa, titik undur, semakan) | devops-engineer | T-A4, T-B11 | 0.5 | ⬜ | |
| T-A8 | Semak drill pemulihan UAT (baca sahaja: log terakhir, pemasa); jika tiada bukti terkini, minta kelulusan PO untuk larian drill | devops-engineer | — | 0.25 | 🔄 | |
| T-A9 | Fail UAT (gambar, muat naik): tentukan apa dibawa ke DB baharu; sahkan laluan storan fail sepadan selepas bina semula | devops-engineer | T-B6 | 0.25 | ⬜ | |

### Aliran B — Data V2 (ganti penuh)

| ID | Tugas | Pemilik | Bergantung | Anggaran (hari) | Status | Bukti |
|---|---|---|---|---|---|---|
| T-B1 | Rebase ETL ke skema HEAD: `be:lint:migration`, `test/migration/*` hijau (dalam Linux), kemas kini langkah battle/permainan dan model yang berubah sejak `cb7332d0b`; raptai sintetik saiz `medium` | backend-developer | T-A2 | 1.5 | 🔄 | |
| T-B2 | Tambah ~10 jadual produksi V2 yang tiada dalam spec staging (senarai dari skema produksi, baca sahaja) | backend-developer | T-B1 | 0.5 | ✅ | spec staging 134 jadual (89+45), +7 jadual (6 Laravel runtime + school_battle_rankings); staging_cloud.sql dan fixture tiny dijana semula |
| T-B3 | Dump V2 baharu (baca sahaja, ikut `docs/ops/cloud-dump-procedure.md`, data sebenar tanpa anonimisasi); simpan di luar repo, disulitkan/berhad, padam selepas cutover | devops-engineer | T-B2 | 0.5 | 🔄 | |
| T-B4 | `staging:load` + `staging:profile` lokal; luaskan peta enum, senarai yatim dan pendua; laporan profil | backend-developer | T-B3 | 0.5 | ⬜ | |
| T-B5 | Pengguna: peranan `agent` dan `jpn_officer`; terbit `grade` dari teks `kelas` V2 (aturan dipersetujui); pengendalian hash roster (KP-7); pendua e-mel | backend-developer | T-B4 | 1 | ⬜ | |
| T-B6 | Kandungan: baiki tolakan artikel (92), nota (10), tiket (3); salin fail kandungan (banner, artikel, nota, audio) dengan manifest `SHA256SUMS` | backend-developer | T-B4 | 1 | ⬜ | |
| T-B7 | Kelas guru (20 tidak layak), sesi/jawapan/dompet yatim (227 / 1,965 / 527), headcount (12): muat atau rekod sebab yang dipersetujui | backend-developer | T-B4 | 1 | ⬜ | |
| T-B8 | Gamifikasi: `gifts` (50) dan tebusan (7) dengan nilai KP-6; semak semula langkah dompet, lejar, streak, pencapaian | backend-developer | T-B4 | 0.5 | ⬜ | |
| T-B9 | Bank soalan: 1,801 tolakan diluluskan; stimulus (1,931) dan gambar rajah (perlu akses baca storan fail V2, item K3); soalan berstruktur (4,061 / 10,296 sub) dan subjektif (2,015); diarkib/draf ikut KP-5; semua boleh dibaiki dalam skrin V3 (Regroup, Soalan tanpa Bab, Audit Rajah). **Wajib (PO, D90/D105): baiki kecacatan V2 — soalan ke-2 dan seterusnya yang merujuk rajah sama tiada rajah; rajah yang terasing menjadi "soalan" sendiri. ETL mesti mengesan dan menukar rajah terasing kepada rangsangan kumpulan, dan memautkan setiap soalan "Rajah n" kepada rangsangan yang sama; yang tidak dapat dipastikan masuk senarai kerja Audit Rajah/Regroup** | solution-architect (reka bentuk) + backend-developer | T-B4 | 11 | 🔄 | |
| T-B10 | Bijak SPM: peta dan muat 60 set ramalan, 175 `exam_papers`, 36 blueprint ke model kertas/kontrak/blueprint V3 (atau keputusan bina semula ikut KP-5) | solution-architect + backend-developer | T-B9 | 2.5 | 🔄 | |
| T-B11 | Raptai penuh lokal: DB kosong → migrate HEAD → seed rujukan → `migrate:all --apply` → `migrate:verify` → larian kedua (0 perubahan); catat masa setiap langkah; laporan recon V2 lawan V3 setiap entiti | devops-engineer + backend-developer | T-A3, T-B5..B10 | 1 | ⬜ | |
| T-B12 | Ujian asap atas data dimigrasi: log masuk setiap peranan (akaun sampel), latihan, keputusan, kelas guru, admin sekolah, Bijak SPM, soalan rajah bergambar | qa-engineer | T-B11 | 0.5 | ⬜ | |

### Aliran C — Ciri

| ID | Tugas | Pemilik | Bergantung | Anggaran (hari) | Status | Bukti |
|---|---|---|---|---|---|---|
| T-C1 | Pautan menu Hadiah/Tebusan dan Permainan (PG-06, PG-11) ke laluan yang sudah wujud | frontend-developer | — | 0.25 | ✅ | cab9d1a88: PG-01..06, PG-10, PG-11 berpautan; peta kanonik --check lulus |
| T-C2 | UI admin Gamifikasi: Overview, Tier Config (baca sahaja), Cabaran (baca sahaja), Pelajar, Transaksi, Kawalan Reward; atas endpoint sedia ada (`admin/gamification`, `reward-control`); tajuk dan label ikut V2 | frontend-developer | — | 2 | ✅ | cab9d1a88: 6 skrin baca sahaja ikut V2; 39 ujian + shell 37 lulus; 375/768/1536 tiada skrol mendatar |
| T-C3 | Bijak SPM G-01 hingga G-05: sahkan semula, baiki yang masih gagal (Jana set terkunci, lajur DSKP CSV, stimulus hilang semasa simpan draf, Topik tidak ditapis ikut Bab) | backend-developer + frontend-developer | — | 1 | ✅ | G-01, G-02, G-04 dibaiki; G-05 sudah siap; G-03 → T-C13 |
| T-C4 | Pengekstrak PDF sebenar dengan tesseract (bukan `heuristik-1`): pecah pilihan A–D, ujian atas kertas contoh | backend-developer | T-A5 | 1.5 | ✅ | segmenter-1: 6/6 soalan dan pilihan pada teks, campuran dan imbasan penuh; rajah dikumpul ikut peraturan PO; bukti Linux 28.6 s. Baki kecil: id penyedia dalam kontrak masih "mock" |
| T-C5 | Kiraan bercanggah admin sekolah (murid 20 lawan 17, guru 3 lawan 4) dan dua jumlah Amaran Awal: satu sumber kiraan | backend-developer | — | 0.5 | ✅ | dae94516f: XS-1/XS-3 di Monitoring + Kirkpatrick; spec xs-consistency 3/3; Amaran sama 0/2/5 |
| T-C6 | Remedial tidak menjana, Heatmap kosong, kad "Pakej SPM Aktif", Kedudukan: sahkan semula dan baiki | backend-developer + frontend-developer | — | 1 | ✅ | dae94516f: Remedial dibaiki (juga baris V2); Heatmap dan kad Pakej betul; Kedudukan → T-C14 |
| T-C7 | 14 laluan frontend tanpa backend (`/api/guru/gamification*`, `/api/parent/hadiah-approvals`, `/api/spm-mocks`, `/api/games/pertandingan`, `/api/games/uji-minda`, `/api/gamification/leaderboard`, `/api/battle/:id`, `/api/admin/config/defaults` dan lain-lain): buang jika skrin ditangguhkan, bina jika dalam skop | frontend-developer + backend-developer | — | 1 | ✅ | dae94516f: 26 laluan disemak; yang ditangguh tidak dipanggil dalam mod http |
| T-C8 | Seed rujukan bersih: tiada "QA-GAP", "E2E fixture", "Contoh:", "Demo" dalam data rujukan produksi (data UAT lama hilang dengan ganti penuh) | backend-developer | T-A3 | 0.25 | ⬜ | |
| T-C9 | Kemas kini spec E2E yang masih guna tajuk/label lama (m02, m03, m04, m07, m09, m12, m15, m27) | qa-engineer | — | 0.5 | ⛔ | 17 spec dikemas kini (teks); belum disahkan: CPU 100%, larian ditahan |
| T-C10 | Baki susun atur: Mod Pelajar pada 375 (semakan visual), lencana mahkota Profil 375 | frontend-developer | — | 0.25 | ✅ | Bar Mod Pelajar wrap OK di 375; butang keluar 32→44px; mahkota Profil tidak lagi menutup huruf awal |
| T-C11 | Tulis semula spec E2E mock untuk shell Pembelajaran (id `shell-user-*` tiada sejak 17 Okt: m01, m07, m27 dan lain-lain) dan triage drift data seed (m02 smoke-users: kiraan, `users-stat-count`, baris admin sendiri); heading "⚙️ Tetapan Peribadi" pada /tetapan | qa-engineer | T-C9 | 1 | ⬜ | |
| T-C12 | Medan backend untuk pariti admin Gamifikasi V2: kiraan "sertai / siap" Cabaran, Streak pelajar, Status dan Harga Token hadiah (Kawalan Reward), warna tier, penapis tier ikut id; jenis `id` (string lawan number) | backend-developer | T-C2 | 0.5 | ✅ | dae94516f: sertai/siap, Streak, Harga Token + Status, data tier, id string |
| T-C13 | Soalan berkumpulan / berstimulus (rajah) dalam Latihan Bab dan latihan murid (D105 / S5-T03 Part B): kontrak latihan, mula sesi, `QuizRunner.vue`, bendera `GROUP_SURFACES`. Wajib jika soalan rajah V2 (T-B9) mahu boleh dilatih murid | backend-developer + frontend-developer | — | 2 | 🔄 | |
| T-C14 | Kedudukan murid ikut R1-MUR-18 (kad "Dalam sekolah / Dalam negeri / Kebangsaan", "Sekitar anda", susunan ikut syiling dompet; penapis V3 dibuang) — kad S7-T06 | backend-developer + frontend-developer | — | 1 | 🔄 | |
| T-C15 | Jenis frontend tahap T1..T5 (m11 `api/types.ts`); label "Pelajar Berdaftar (T4/T5)" di komponen M12 dibuang "(T4/T5)" ikut PRD | frontend-developer | T-C5 | 0.25 | 🔄 | |

### Gerbang G-100 (Fasa 4)

| ID | Tugas | Pemilik | Bergantung | Anggaran (hari) | Status | Bukti |
|---|---|---|---|---|---|---|
| T-Q1 | Audit penuh setiap peranan pada 375 / 768 / 1280 atas salinan lokal data V2 (tiga lorong browser) | qa-engineer ×3 | T-B12, T-C* | 1 | ⬜ | |
| T-Q2 | Suite E2E penuh hijau | qa-engineer | T-C9 | 0.5 | ⬜ | |
| T-Q3 | Code review: ETL, prosedur bina semula DB, perubahan backend Fasa 2–3 | code-reviewer | T-B11, T-A4 | 0.5 | ⬜ | |
| T-Q4 | Semakan keselamatan: dump PII (simpanan, pemadaman), hash kata laluan, akses fail V2, env | security-engineer | T-B3, T-A4 | 0.5 | ⬜ | |
| T-Q5 | Semak semula kesemua K1–K9; kemas kini laporan kesediaan ke 100% | Lead | T-Q1..Q4 | 0.25 | ⬜ | |

### Fasa 5 — Pelepasan UAT (hanya selepas G-100 dan kelulusan PO)

| ID | Tugas | Pemilik | Bergantung | Status |
|---|---|---|---|---|
| T-R1 | PO lulus push, tetingkap deploy, notis downtime (KP-8, KP-9, KP-10) | PO | T-Q5 | ⬜ |
| T-R2 | Push `feature/v3-bijak-r1` ke origin | Lead | T-R1 | ⬜ |
| T-R3 | Dump V2 akhir (baca sahaja) sejurus sebelum cutover | devops-engineer | T-R1 | ⬜ |
| T-R4 | Backup penuh UAT (DB + fail) + `pg_restore --list` | devops-engineer | T-R1 | ⬜ |
| T-R5 | Deploy kod (tanpa seed demo), bina semula DB, seed rujukan, ETL penuh, `migrate:verify` | devops-engineer | T-R2..R4 | ⬜ |
| T-R6 | Ujian asap UAT setiap peranan; recon dibanding raptai | qa-engineer | T-R5 | ⬜ |
| T-R7 | PO sign-off; padam salinan dump PII lokal | PO, devops-engineer | T-R6 | ⬜ |

## 5. Risiko

| Risiko | Mitigasi |
|---|---|
| Bank soalan (T-B9/B10) lebih besar daripada jangkaan | Reka bentuk dahulu oleh solution-architect; KP-5 menetapkan skop; muat berperingkat |
| Akses storan fail V2 (gambar rajah) | Minta laluan baca sahaja awal (Hari 1); salin dengan manifest |
| PII dalam dump lokal | Simpan di luar repo, akses berhad, padam selepas T-R7; tidak masuk git, dokumen atau mesej |
| Data UAT sejak 29 Okt hilang (ganti penuh) | Diterima PO (KP-2); backup penuh T-R4 disimpan |
| V2 terus hidup selepas dump | KP-8; `migrate:delta` jika perlu |
| Masa cutover panjang (raptai sintetik ~527 s untuk 20k pengguna) | Masa sebenar diukur di T-B11; tetingkap ditetapkan dari situ |

## 6. Log kemajuan

| Tarikh | Perubahan |
|---|---|
| 2026-11-10 | Pelan dan tracker dicipta. Kesediaan permulaan ~60% (ciri ~70%, deploy ~60%, data ~50%). |
| 2026-11-10 | Gelombang 1 bermula: T-A1, T-A2, T-A3, T-A5, T-A6, T-A8, T-B1, T-B2, T-C1, T-C2, T-C5, T-C6 (4 ejen selari). Prinsip PO: data V2 mesti berfungsi dalam V3, bukan sekadar disalin. |
| 2026-11-10 | Ditambah selari (tidak bertindih): T-C3 (Bijak SPM G-01..G-05), T-C9 (spec E2E). T-C4 menunggu T-A5 (OCR); T-C7 menunggu T-C2 (laluan gamifikasi). |
| 2026-11-10 | T-C9: 17 spec E2E dikemas kini ikut tajuk/label V2 tetapi belum disahkan (CPU 100%; 2 larian Playwright + vite preview 4173 masih hidup, tidak dapat dihentikan oleh sesi — perlu tindakan PO). Ditemui drift lama: spec mock shell-user-* sejak 17 Okt, data seed m02 → tugas baharu T-C11. |
| 2026-11-10 | T-B2 ✅. T-B1 diteruskan oleh ejen baharu (ejen pertama kehabisan ruang; prosesnya, bekas tb1-pg dan folder .migration-out dibersihkan oleh Lead). Penemuan: seed produksi tidak memuat kurikulum/DSKP (diserah ke T-A3); MCQ dimuat tanpa medan DSKP/kognitif/kesukaran → skrip uat-ops selepas ETL (T-A7, T-B9). |
| 2026-11-10 | T-C1 ✅, T-C2 ✅ (cab9d1a88). Jurang backend untuk pariti penuh → T-C12. DsDataTable: slot sel dalam paparan kad bawah md dibaiki. |
| 2026-11-10 | T-C7 dan T-C12 bermula (satu ejen backend). |
| 2026-11-10 | T-C3 ✅ (G-01, G-02, G-04 dibaiki; G-05 sudah siap). G-03 ialah ciri tertangguh D105 Part B → T-C13, perlu keputusan PO (KP-11). imports.spec 2 kegagalan timeout perlu larian semula di mesin lapang (G-100). |
| 2026-11-10 | T-A1, T-C5, T-C6, T-C7, T-C12 ✅ (dae94516f). Ditambah T-C14 (Kedudukan R1-MUR-18) dan T-C15 (label/jenis T1..T5). T-C13 (rajah dalam latihan murid) diputuskan bina kerana V2 memaparkan gambar soalan dalam latihan (pariti). |
| 2026-11-10 | Keperluan teras PO direkodkan untuk T-C13 dan T-B9: setiap soalan dalam kumpulan rajah memaparkan rajah (bukan soalan pertama sahaja); rajah tidak pernah menjadi soalan sendiri; kecacatan V2 ini dibaiki semasa migrasi, bukan disalin. |
| 2026-11-10 | Dimulakan selari: T-B3 (dump V2 baca sahaja + inventori fail), reka bentuk T-B9/T-B10 (docs/architecture/v2-question-bank-migration.md), T-C4 (pengekstrak PDF tesseract), T-C10 (Mod Pelajar 375, mahkota Profil). 8 ejen aktif. |
| 2026-11-10 | KP-5 (bawa semua yang tidak dipadam), KP-7 (kata laluan roster kekal) diputuskan; KP-6 ditutup (nilai V2); KP-8 di luar skop. |
| 2026-11-10 | Reka bentuk T-B9/T-B10 siap (88ff308b9, docs/architecture/v2-question-bank-migration.md). Anggaran disemak: T-B9 ~11 hari-dev, T-B10 ~2.5 (KP-5 bawa semua). Pelaksanaan dimulakan dengan 2 ejen selari: T-B9a (spec lajur, migrate:questions semua status, perancang rajah, penulis kumpulan) dan T-B9b (berstruktur/subjektif, bank kanonik, set SPM, blueprint, kertas, Terbit). OC-3/OC-4 ikut prinsip KP-5. |
| 2026-11-10 | T-C10 ✅. Mesin tersumbat (CPU 99%, Docker tergantung, 5194 tidak menjawab): dengan kelulusan PO, 2 Vite tinggalan ejen dan MCP Cloudflare yang tersangkut dihentikan, Docker Desktop dimulakan semula, stack pp-v3 dihidupkan semula; ejen diarah cipta semula bekas dan hadkan beban ujian (maxWorkers 2). |
| 2026-11-10 | T-C4 ✅ (pengekstrak PDF sebenar dengan tesseract). |
