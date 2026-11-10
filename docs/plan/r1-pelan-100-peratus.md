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
| K10 | **Soalan dimigrasi serasi dengan proses tambah soalan V3 (PO 10 Nov):** untuk setiap jenis (MCQ, MCQ 2 pilihan / dilabel semula, soalan rajah berkumpulan, berstruktur, subjektif, diarkib, draf), soalan V2 yang dimigrasi boleh dibuka, disunting, disimpan dan dihantar untuk semakan di Studio melalui HTTP, dengan validasi yang sama seperti soalan baharu (gerbang DSKP, pasangan Bab–Tajuk, kunci jawapan, kumpulan rajah); bentuk data soalan dimigrasi dan soalan baharu tidak berbeza | Spec HTTP Studio atas soalan dimigrasi + semakan di UAT |

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
| KP-12 | Kenalan sokongan (e-mel, WhatsApp, waktu) | Diputuskan 10 Nov (PO melalui mandor): biar KOSONG; Admin Pusat isi sendiri di Tetapan > Hubungi Sokongan. Semakan selepas bina semula tidak boleh gagal kerana kosong (item PO) |
| KP-13 | Akaun ujian guru dan admin sekolah di UAT | Diputuskan 10 Nov (PO melalui mandor): LEAD cipta 1 guru + 1 admin sekolah QA di sekolah sebenar selepas bina semula ke-5, dengan pengesahan PO dalam sesi LEAD; login hanya dalam fail kelayakan luar repo |

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

| ID | Tugas | Pemilik | Bergantung | Anggaran (jam ejen) | Status | Bukti |
|---|---|---|---|---|---|---|
| T-A1 | Larian berasingan `test/support/tickets.spec.ts` dan `test/conformance/run.spec.ts`; baiki regresi sebenar (tiket, `/rph`, semakan esei) | backend-developer | — | 0.5 | ✅ | dae94516f: tickets 34/34, conformance 430/430 (bendera ciri + peranan smoke) |
| T-A2 | Larian penuh ujian backend dalam bekas Linux (elak artifak Windows pada `test/migration/*`, `answer-store-writers`); senaraikan setiap kegagalan tinggal dengan punca | devops-engineer | — | 0.5 | ⛔ | Pelari Linux siap (deploy/test); larian fokus 116 fail; suite penuh perlu mesin lapang → dijalankan di G-100 |
| T-A3 | Laluan DB kosong: Postgres 16 baharu → `prisma migrate deploy` 0001 hingga HEAD → `be:db:seed` rujukan (tanpa demo); sahkan kurikulum/DSKP (2,844 nod, 1,394 deskriptor TP), subjek, pakej sekolah tepat dan tiada kandungan demo/ujian | devops-engineer | — | 0.5 | ✅ | f04e4cf95: 111 migrasi dari kosong OK; seed rujukan kini memuat kurikulum (3,652 nod, 1,394 TP, 33 subjek, 1,311 bab); idempoten; tiada data demo |
| T-A4 | Prosedur "bina semula DB" berpengawal untuk UAT (backup → henti api → drop/create DB → migrate → seed rujukan → ETL → mula api), dengan pengesahan nama DB dan bendera eksplisit; raptai lokal | devops-engineer | T-A3 | 1 | ✅ | |
| T-A5 | OCR: imej api dengan tessdata, `OCR_ENGINE=tesseract`, `OCR_LANG_DIR`; ujian pengekstrakan satu PDF contoh dalam bekas | devops-engineer | — | 0.5 | ✅ | tessdata msa+eng dalam imej api; OCR_ENGINE=tesseract, OCR_LANG_DIR=/opt/tessdata; probe OK |
| T-A6 | Env UAT: senarai nilai baharu (had muat naik 32/336, OCR, `PP_RELEASE_SHA`); tiada rahsia dalam repo | devops-engineer | T-A5 | 0.25 | ✅ | docs/ops/r1-uat-env-changes.md; PUPIL_DEFAULT_PASSWORD diperlukan (nilai dari PO semasa pelepasan) |
| T-A7 | Kemas kini `docs/ops/r1-uat-deploy.md` dan tulis runsheet cutover ganti penuh (langkah, masa, titik undur, semakan) | devops-engineer | T-A4, T-B11 | 0.5 | ✅ | |
| T-A8 | Semak drill pemulihan UAT (baca sahaja: log terakhir, pemasa); jika tiada bukti terkini, minta kelulusan PO untuk larian drill | devops-engineer | — | 0.25 | ✅ | backup malam sihat; drill terakhir 2 Nov (PASS) — drill manual sebelum T-R4 perlu kelulusan PO; retensi data mentah .cloud di UAT tertunggak (keputusan PO semasa pelepasan) |
| T-A9 | Fail UAT (gambar, muat naik): tentukan apa dibawa ke DB baharu; sahkan laluan storan fail sepadan selepas bina semula | devops-engineer | T-B6 | 0.25 | 🔄 | |

### Aliran B — Data V2 (ganti penuh)

| ID | Tugas | Pemilik | Bergantung | Anggaran (jam ejen) | Status | Bukti |
|---|---|---|---|---|---|---|
| T-B1 | Rebase ETL ke skema HEAD: `be:lint:migration`, `test/migration/*` hijau (dalam Linux), kemas kini langkah battle/permainan dan model yang berubah sejak `cb7332d0b`; raptai sintetik saiz `medium` | backend-developer | T-A2 | 1.5 | ✅ | ETL pada skema HEAD; raptai penuh dari DB kosong + verify + muat kedua idempoten; semakan fungsi V3 lulus; peraturan anonimiser 81 lajur; pelari Linux menjalankan semua spec staging/keselamatan; baki 9 kegagalan dalam kerja T-B9a |
| T-B2 | Tambah ~10 jadual produksi V2 yang tiada dalam spec staging (senarai dari skema produksi, baca sahaja) | backend-developer | T-B1 | 0.5 | ✅ | spec staging 134 jadual (89+45), +7 jadual (6 Laravel runtime + school_battle_rankings); staging_cloud.sql dan fixture tiny dijana semula |
| T-B3 | Dump V2 baharu (baca sahaja, ikut `docs/ops/cloud-dump-procedure.md`, data sebenar tanpa anonimisasi); simpan di luar repo, disulitkan/berhad, padam selepas cutover | devops-engineer | T-B2 | 0.5 | ✅ | Dump penuh baca sahaja (137 jadual, 2,412,828 baris, kiraan sepadan prod); staging:load 134 jadual OK; profil: 0 pendua e-mel, semua 7,026 hash bcrypt, yatim kecil disenaraikan; fail 10,316 / 2.47 GB, 0 rujukan hilang |
| T-B3b | Salin fail gambar V2 (baca sahaja) ke scratchpad dan sahkan sha256 | devops-engineer | T-B3 | 0.25 | ✅ | 10,316 fail / 2.35 GiB dalam 3.3 minit; 10,316 sha256 sepadan, 0 hilang; beban server puncak 0.86 |
| T-B4 | `staging:load` + `staging:profile` lokal; luaskan peta enum, senarai yatim dan pendua; laporan profil | backend-developer | T-B3 | 0.5 | ✅ | dibuat dalam T-B3: staging 134 jadual, profil sebenar |
| T-B5 | Pengguna: peranan `agent` dan `jpn_officer`; terbit `grade` dari teks `kelas` V2 (aturan dipersetujui); pengendalian hash roster (KP-7); pendua e-mel | backend-developer | T-B4 | 1 | ✅ | 7,026/7,026 pengguna; log masuk semua peranan; grade: 1,524 + 537 diterbitkan dari kelas |
| T-B6 | Kandungan: baiki tolakan artikel (92), nota (10), tiket (3); salin fail kandungan (banner, artikel, nota, audio) dengan manifest `SHA256SUMS` | backend-developer | T-B4 | 1 | ✅ | artikel 92, nota 10, tiket 3, banner 10 dimuat (teks artikel → T-B5b) |
| T-B7 | Kelas guru (20 tidak layak), sesi/jawapan/dompet yatim (227 / 1,965 / 527), headcount (12): muat atau rekod sebab yang dipersetujui | backend-developer | T-B4 | 1 | ✅ | 13/33 kelas (20 tiada guru/sekolah/murid di V2); 569 sesi, 5,622 jawapan (baki milik pengguna dipadam) |
| T-B8 | Gamifikasi: `gifts` (50) dan tebusan (7) dengan nilai KP-6; semak semula langkah dompet, lejar, streak, pencapaian | backend-developer | T-B4 | 0.5 | ✅ | 50 hadiah, 7 tebusan, tier, 33,452 lejar, 2,649 dompet murid (bajet tebusan → T-B5b) |
| T-B5b | Baiki: teks artikel/nota V2 (lajur body kosong), bajet tebusan dari V2, skop pegawai PPD/JPN dan guru tanpa sekolah supaya boleh log masuk | backend-developer | T-B5..B8 | 1.5 | 🔄 | |
| T-B9 | Bank soalan: 1,801 tolakan diluluskan; stimulus (1,931) dan gambar rajah (perlu akses baca storan fail V2, item K3); soalan berstruktur (4,061 / 10,296 sub) dan subjektif (2,015); diarkib/draf ikut KP-5; semua boleh dibaiki dalam skrin V3 (Regroup, Soalan tanpa Bab, Audit Rajah). **Wajib (PO, D90/D105): baiki kecacatan V2 — soalan ke-2 dan seterusnya yang merujuk rajah sama tiada rajah; rajah yang terasing menjadi "soalan" sendiri. ETL mesti mengesan dan menukar rajah terasing kepada rangsangan kumpulan, dan memautkan setiap soalan "Rajah n" kepada rangsangan yang sama; yang tidak dapat dipastikan masuk senarai kerja Audit Rajah/Regroup** | solution-architect (reka bentuk) + backend-developer | T-B4 | 4 | ✅ | |
| T-B10 | Bijak SPM: peta dan muat 60 set ramalan, 175 `exam_papers`, 36 blueprint ke model kertas/kontrak/blueprint V3 (atau keputusan bina semula ikut KP-5) | solution-architect + backend-developer | T-B9 | 1 | ✅ | |
| T-B13 | Kertas Subjektif V2 (254 dokumen, 7,424 halaman gambar) dibawa ke V3 dengan skrin admin + murid seperti V2; kertas yang diterbitkan dalam V2 kekal diterbitkan dalam V3 | backend-developer | T-B10 | 3 | ✅ | Migrasi 0265, API + skrin admin/murid seperti V2; 254 dokumen / 7,424 halaman (SQL); laluan Terbit warisan beraudit; spec 17+5+1+3 lulus |
| T-B13b | Kertas V2 yang diterbitkan kekal diterbitkan: simpulkan nombor kertas (48/69 kosong) dan tempoh (64/69 kosong) dari data V2 / konfigurasi SPM | backend-developer | T-B13 | 1 | 🔄 | |
| T-B11 | Raptai penuh lokal: DB kosong → migrate HEAD → seed rujukan → `migrate:all --apply` → `migrate:verify` → larian kedua (0 perubahan); catat masa setiap langkah; laporan recon V2 lawan V3 setiap entiti | devops-engineer + backend-developer | T-A3, T-B5..B10 | 1 | ⬜ | |
| T-B12 | Ujian asap atas data dimigrasi: log masuk setiap peranan (akaun sampel), latihan, keputusan, kelas guru, admin sekolah, Bijak SPM, soalan rajah bergambar | qa-engineer | T-B11 | 0.5 | ⬜ | |

### Aliran C — Ciri

| ID | Tugas | Pemilik | Bergantung | Anggaran (jam ejen) | Status | Bukti |
|---|---|---|---|---|---|---|
| T-C1 | Pautan menu Hadiah/Tebusan dan Permainan (PG-06, PG-11) ke laluan yang sudah wujud | frontend-developer | — | 0.25 | ✅ | cab9d1a88: PG-01..06, PG-10, PG-11 berpautan; peta kanonik --check lulus |
| T-C2 | UI admin Gamifikasi: Overview, Tier Config (baca sahaja), Cabaran (baca sahaja), Pelajar, Transaksi, Kawalan Reward; atas endpoint sedia ada (`admin/gamification`, `reward-control`); tajuk dan label ikut V2 | frontend-developer | — | 2 | ✅ | cab9d1a88: 6 skrin baca sahaja ikut V2; 39 ujian + shell 37 lulus; 375/768/1536 tiada skrol mendatar |
| T-C3 | Bijak SPM G-01 hingga G-05: sahkan semula, baiki yang masih gagal (Jana set terkunci, lajur DSKP CSV, stimulus hilang semasa simpan draf, Topik tidak ditapis ikut Bab) | backend-developer + frontend-developer | — | 1 | ✅ | G-01, G-02, G-04 dibaiki; G-05 sudah siap; G-03 → T-C13 |
| T-C4 | Pengekstrak PDF sebenar dengan tesseract (bukan `heuristik-1`): pecah pilihan A–D, ujian atas kertas contoh | backend-developer | T-A5 | 1.5 | ✅ | segmenter-1: 6/6 soalan dan pilihan pada teks, campuran dan imbasan penuh; rajah dikumpul ikut peraturan PO; bukti Linux 28.6 s. Baki kecil: id penyedia dalam kontrak masih "mock" |
| T-C5 | Kiraan bercanggah admin sekolah (murid 20 lawan 17, guru 3 lawan 4) dan dua jumlah Amaran Awal: satu sumber kiraan | backend-developer | — | 0.5 | ✅ | dae94516f: XS-1/XS-3 di Monitoring + Kirkpatrick; spec xs-consistency 3/3; Amaran sama 0/2/5 |
| T-C6 | Remedial tidak menjana, Heatmap kosong, kad "Pakej SPM Aktif", Kedudukan: sahkan semula dan baiki | backend-developer + frontend-developer | — | 1 | ✅ | dae94516f: Remedial dibaiki (juga baris V2); Heatmap dan kad Pakej betul; Kedudukan → T-C14 |
| T-C7 | 14 laluan frontend tanpa backend (`/api/guru/gamification*`, `/api/parent/hadiah-approvals`, `/api/spm-mocks`, `/api/games/pertandingan`, `/api/games/uji-minda`, `/api/gamification/leaderboard`, `/api/battle/:id`, `/api/admin/config/defaults` dan lain-lain): buang jika skrin ditangguhkan, bina jika dalam skop | frontend-developer + backend-developer | — | 1 | ✅ | dae94516f: 26 laluan disemak; yang ditangguh tidak dipanggil dalam mod http |
| T-C8 | Seed rujukan bersih: tiada "QA-GAP", "E2E fixture", "Contoh:", "Demo" dalam data rujukan produksi (data UAT lama hilang dengan ganti penuh) | backend-developer | T-A3 | 0.25 | ✅ | Disahkan dalam T-A3: seed rujukan tiada QA-GAP, E2E, @demo.test, example.test; ganti penuh membuang data ujian lama UAT |
| T-C9 | Kemas kini spec E2E yang masih guna tajuk/label lama (m02, m03, m04, m07, m09, m12, m15, m27) | qa-engineer | — | 0.5 | ⛔ | 17 spec dikemas kini (teks); belum disahkan: CPU 100%, larian ditahan |
| T-C10 | Baki susun atur: Mod Pelajar pada 375 (semakan visual), lencana mahkota Profil 375 | frontend-developer | — | 0.25 | ✅ | Bar Mod Pelajar wrap OK di 375; butang keluar 32→44px; mahkota Profil tidak lagi menutup huruf awal |
| T-C11 | Tulis semula spec E2E mock untuk shell Pembelajaran (id `shell-user-*` tiada sejak 17 Okt: m01, m07, m27 dan lain-lain) dan triage drift data seed (m02 smoke-users: kiraan, `users-stat-count`, baris admin sendiri); heading "⚙️ Tetapan Peribadi" pada /tetapan; spec m08 Kedudukan (t4-ranking-leaderboard S19, qa-g5-responsive URL /ranking?scope, qa-g5-access-nav baris 265) | qa-engineer | T-C9 | 1 | ⬜ | |
| T-C12 | Medan backend untuk pariti admin Gamifikasi V2: kiraan "sertai / siap" Cabaran, Streak pelajar, Status dan Harga Token hadiah (Kawalan Reward), warna tier, penapis tier ikut id; jenis `id` (string lawan number) | backend-developer | T-C2 | 0.5 | ✅ | dae94516f: sertai/siap, Streak, Harga Token + Status, data tier, id string |
| T-C13 | Soalan berkumpulan / berstimulus (rajah) dalam Latihan Bab dan latihan murid (D105 / S5-T03 Part B): kontrak latihan, mula sesi, `QuizRunner.vue`, bendera `GROUP_SURFACES`. Wajib jika soalan rajah V2 (T-B9) mahu boleh dilatih murid | backend-developer + frontend-developer | — | 2 | ✅ | 1dbfb83e0: Latih Tubi, Databank, Soalan by Chapter, Set Soalan Guru, Remedial, Ulang Kaji; rajah pada setiap ahli kumpulan; kumpulan tidak dipecah; ujian HTTP sebenar lulus |
| T-C14 | Kedudukan murid ikut R1-MUR-18 (kad "Dalam sekolah / Dalam negeri / Kebangsaan", "Sekitar anda", susunan ikut syiling dompet; penapis V3 dibuang) — kad S7-T06 | backend-developer + frontend-developer | — | 1 | ✅ | Kedudukan ikut syiling: kad kelas/sekolah/negeri/kebangsaan, Sekitar anda; spec SQL sebenar 7/7; 375/768/1280 tiada skrol mendatar |
| T-C15 | Jenis frontend tahap T1..T5 (m11 `api/types.ts`); label "Pelajar Berdaftar (T4/T5)" di komponen M12 dibuang "(T4/T5)" ikut PRD | frontend-developer | T-C5 | 0.25 | ✅ | jenis T1..T5; label M12 tanpa "T4/T5" |
| T-C16 | Tracking A sokong soalan rajah/kumpulan (D105); baiki spec pipeline-chain (pasangan Bab–Tajuk); kemas kini PRD 46 §5.1 ikut D105 | backend-developer | T-C13 | 0.75 | ✅ | 17ba836dd: Tracking A rajah + kumpulan (susunan V2); pipeline-chain 48/48; PRD 46/49 ikut D105; servability-lanes 26/26 |

### Gerbang G-100 (Fasa 4)

| ID | Tugas | Pemilik | Bergantung | Anggaran (jam ejen) | Status | Bukti |
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
| 2026-11-10 | T-C14 ✅, T-C15 ✅. Spec E2E Kedudukan lama ditambah ke T-C11. |
| 2026-11-10 | T-B3 ✅ (dump V2 penuh, baca sahaja; disimpan di scratchpad sahaja). T-B3b dimulakan: salin 2.47 GB fail gambar V2 (baca sahaja, semakan sha256). T-B9a pertama kehabisan ruang (kod belum diuji); bekas tb9a dibersihkan oleh Lead; T-B9a disambung oleh ejen baharu yang terus menguji pada data V2 sebenar. |
| 2026-11-10 | T-B3b ✅: semua fail gambar V2 disalin dan disahkan. Prosedur didokumenkan di docs/ops/cloud-dump-procedure.md §12. |
| 2026-11-10 | DevOps: A3, A5, A6, A8 ✅ (f04e4cf95); A2 menunggu mesin lapang. B4 ✅ (dalam B3). B1: raptai penuh + semakan fungsi V3 lulus (log masuk bcrypt V2 → argon2, latihan, kelas, kandungan); kecacatan stem berganda pada muatan soalan → dibaiki dalam T-B9a. Dimulakan: T-A4/A7 (skrip bina semula berpengawal + runsheet + bab auto T1–T3), T-B5..B8 (pengguna, kandungan, kelas, hadiah) atas data sebenar, T-B13 (Kertas Subjektif V2 + kertas diterbitkan). |
| 2026-11-10 | T-C13 ✅ (1dbfb83e0). T-C16 dimulakan untuk baki: Tracking A, spec pipeline-chain, PRD. ETL dimaklumkan: files.public_id dan pautan kumpulan wajib supaya rajah V2 dipaparkan. |
| 2026-11-10 | T-B1 ✅. Baki kegagalan ujian migrasi diserahkan kepada T-B9a (kiraan KP-5, bendera rangsangan, senarai never-stage). |
| 2026-11-10 | Anggaran ditukar kepada jam ejen (PO: jangan kira masa manusia). Baki kerja dijangka siap malam ini; raptai penuh + G-100 esok pagi. |
| 2026-11-10 | T-C16 ✅. Arahan PO: ujian data di PC local guna SAMPEL pelbagai senario sahaja; muatan penuh hanya di UAT — semua ejen data dimaklumkan. |
| 2026-11-10 | T-B5..T-B8 ✅ pada data V2 sebenar. Pembaikan susulan T-B5b dimulakan (teks artikel, bajet tebusan, skop pegawai). |
| 2026-11-10 | T-B13 ✅. T-B13b dimulakan. Keputusan PO: dompet syiling guru V2 disimpan untuk ekonomi guru kemudian (ditambah ke T-B5b). |
| 2026-11-10 | Strategi baharu (PO): deploy V3 ke UAT sekarang dan uji muatan penuh di server; PC local untuk kod + sampel sahaja. Semua kerja di-commit (86dcb0f36) dan di-push. A4/A7 ✅ (rebuild-db.sh berpengawal, runsheet), B9/B10 ✅ pada sampel sebenar (jangkaan UAT: 448,804 soalan, 813 kumpulan rajah, 698 dikuarantin). Deploy + bina semula DB UAT sedang berjalan. Serah tugas cloud: docs/plan/HANDOFF-cloud-2026-11-10.md. |
| 2026-11-10 | Bina semula UAT percubaan 1 (86dcb0f36): langkah 0–10 lulus, gagal di migrate:papers --apply (FILE_STORAGE_DIR tiada: --files-dir tidak dihantar). Rollback automatik berjaya: UAT kembali ke e34e0a52d515 dengan DB asal, sihat. Dibaiki dalam 5c22f9586 (--files-dir ke migrate:questions dan migrate:papers; skrip boleh laksana). Percubaan 2 sedang berjalan. Diperhatikan: 338 beza baki dompet lawan lejar (dilaporkan). |
| 2026-11-10 | Percubaan 2 (5c22f9586): pengguna, soalan (dengan gambar), berstruktur OK; gagal di migrate:papers --terbit (Nest di bawah tsx tiada metadata decorator → NotificationsService). Rollback automatik berjaya. Percubaan 3 tanpa --terbit (kertas V2 diterbitkan dimuat sebagai draf sementara); Terbit dibina semula melalui build API (tugas sesi cloud). |
| 2026-11-10 | PO: teruskan di local sehingga UAT sedia menggantikan V2 (sesi cloud tidak boleh SSH ke UAT — persekitaran cloud menyekat port 22). Percubaan 3 bina semula UAT sedang di pas 2. Dimulakan selari: A (Terbit melalui build API, kertas warisan tanpa had masa, ujian inferKertas, spec double-upsert), B (migrate:verify untuk semua pemuat, beza dompet–lejar, PKSK sebagai draf, spec B5b, test\/migration hijau), C (K10: soalan dimigrasi melalui Studio HTTP). |
| 2026-11-10 | **UAT bina semula percubaan 3 BERJAYA (09:24 UTC, 64 min): V3 5c22f9586ef5 hidup dengan data V2.** Kiraan: pengguna 7,026 (5,593 aktif); sekolah 10,207; soalan 454,880 (lulus 409,795, arkib 42,501, semakan 2,428, draf 156); kumpulan rajah 813; stimulus 4,931; fail 8,909; dokumen Kertas Subjektif 254 \/ halaman 7,422; kertas 175 (semua draf — Terbit belum dijalankan); hadiah 50; dompet 3,012; sesi latihan 569; artikel 20 (sepatutnya 92 → content-owner). Semakan gagal: chapters-t1-t3 (SK\/BC tiada Bab aktif), support-contact, intake-env (JOBS_WORKER_ENABLED tiada, AI_PROVIDER=mock perlu dibuang, OCR_LANG_DIR disemak dari imej migrate), terbit-papers (belum jalan), smoke F3\/F6\/F10 (KP-7, dijangka) dan X3 (8 entiti melebihi had tolakan — disemak). Agent A siap (1ea25b70f): migrate:terbit melalui build API, kertas warisan tanpa had masa (migrasi 0266). |
| 2026-11-10 | Ejen D ✅ (0ac124d3c): semakan selepas bina semula dibetulkan (bab T1–T3, kenalan sokongan perlu input PO kerana V2 tiada nilai, intake-env dalam imej api, terbit-published.sql). Audit QA baca sahaja di UAT dimulakan (admin + Mod Pelajar, lorong 2). Perlu input PO: e-mel, WhatsApp dan waktu perkhidmatan sokongan. |
| 2026-11-10 | Ejen B ✅ (714d62f87), C ✅ K10 (1e90dcbb0: soalan V2 kini dibuka\/disunting di Studio). Audit QA UAT: B1 Studio 500 (dibaiki oleh C), B2 semua 813 kumpulan rajah ahli arkib (V2 tiada rajah untuk soalan diluluskan — selaras dapatan profil), M1 kiraan bercanggah + 1,432 'menunggu kelulusan' (V2 tidak aktif), M2 kertas SPM 0 soalan \/ 21 hilang, M3 lane Latih Tubi kosong, M6 halaman murid lambat 10–19 s, M7 Audit Rajah kosong. Dimulakan: E (kertas SPM), F (prestasi), G (kiraan, status pengguna, senarai admin, label). |
| 2026-11-10 | Ejen E ✅ + G ✅ (f5e8d585a): kertas V2 kini dimuat bersama soalan (teks V2 {html} sebelum ini menyebabkan 5,704 soalan kanonik ditolak); rajah kanonik sebagai kumpulan; Audit Rajah berfungsi; kiraan ikut V2; Sekolah Berdaftar ikut V2. Menunggu F (prestasi), kemudian deploy + bina semula UAT dengan --terbit. |
| 2026-11-10 | Ejen F ✅ (f38e2b461): halaman murid\/admin pantas pada data sebenar (JIT off, predikat media anti-join, tetingkap id, cache SWR + warmer; hasil sama dibuktikan md5 di UAT). Di-push. Bina semula UAT ke-4 (semua pembaikan + --terbit) dimulakan. Kegagalan ujian sedia ada di HEAD untuk G-100: bijak-papers\/schema, conformance kertas-dokumen, chapter-practice, chapter, draw-bounded, r1\/reqb058, spm-servable card=drawable, contract school-admin dashboard + AdminAnalytics. |
| 2026-11-10 | Bina semula UAT ke-4 (f38e2b461, --terbit, tanpa --verify-soft): ETL pas 1 lulus (soalan 448,804; Terbit exit 0; dokumen 254 \/ halaman 7,422) tetapi gagal di langkah 12 migrate:verify → rollback ke 5c22f9586ef5 berjaya (data sebelumnya utuh, sihat 12:16 UTC). Semakan gagal: jumlah practice_sessions.correct (5,922 lawan 4,851), streak (29), laluan gambar (1,489 lawan 2,115), 346 soalan ditahan kerana gambar, 1,059 tolakan tanpa jangkaan. Apply soalan perlahan (1,630 s lawan 867 s). Ejen pembaikan verify dimulakan; kemudian bina semula ke-5. |
| 2026-11-10 | Ejen I separa (79c3dff47): spec E2E global, m01, m02, m08 diselaraskan dengan shell Pembelajaran; 4 kecacatan UI kecil dibaiki (pautan jemputan melimpah di mudah alih, butang avatar 44px, id kad statistik, 4 ikon luar talian). Desktop: global+m01 80 lulus \/ 1 gagal (kemudian dibaiki); m02 101 gagal dan m08 qa-g5-access-nav ~55 gagal masih perlu ditulis semula; ~60 fail spec lain masih guna shell-user-*. Tablet\/mudah alih belum dijalankan. BUG-I1 (loceng notifikasi tiada dalam shell Pembelajaran) sedang dibaiki. BUG-I2: kiraan pelajar mock 4,453 lawan SRS 4,533 (pemilik M02). |
| 2026-11-10 | Pembaikan verify ✅ (9f0c4233c): hanya laluan gambar benar-benar gagal (jangkaan lapuk; kini 2,115 dikira dari soalan + media_assets kanonik). Kecacatan sebenar dibaiki: migrate:structured tiada langkah gambar (346 soalan kanonik ditahan) — kini --files-dir; imbasan import_issues satu-per-laluan (punca senyap 20 min) diganti satu bacaan. Jangkaan dikira: jawapan betul 4,851 (116 sesi SPM V2 tiada baris jawapan), streak luput 29, tolakan 1,061 (semua kecacatan data V2 sah: 655 MCQ tiada jawapan betul, 43 pilihan kosong, 322+1 bahagian kertas, 32 rangka tiada tempoh), ditahan 38 (2 JPEG V2 melebihi had 50 juta piksel — perlu kecilkan luar talian). Di-push. Bina semula UAT ke-5 dimulakan. |
| 2026-11-10 | Struktur sesi baharu (PO): MANDOR (penyelaras, saluran tunggal PO), LEAD (UAT sektor 1–6, ujian backend, integrasi), A (semakan kod + keselamatan), B (E2E). Bina semula UAT ke-5 (9f0c4233c) berjalan sejak 14:40 UTC. Semakan keselamatan A: Approve (0 Blocker\/Major; 3 Minor S-1..S-3 kepada LEAD selepas bina semula). KP-12, KP-13 direkod. |
