# Senarai Semak Tandatangan R1: Bijak SPM

Untuk Delivery Lead, untuk dibawa kepada pengguna **selepas B1 menggabungkan** unit READY ke dalam cawangan asas. Dokumen ini hanya senarai semak: ia tidak mengandungi keputusan atau keputusan lulus.

**Cara guna.**
- Lajur **Status** sengaja **KOSONG**. Ia ditanda (`[x]`) semasa tandatangan, oleh orang yang menjalankan semakan, selepas bukti dibuka dan dibaca.
- Lajur **Bukti** menunjuk ke fail, cawangan atau seksyen. Kepala cawangan ialah bacaan `git ls-remote origin` pada 2026-11-02 (ditulis semasa dokumen ini disediakan); papan bergerak setiap hari, jadi **semak semula kepala sebelum menanda**.
- **[PROPOSED]** bermaksud tidak disahkan oleh sumber yang ditunjuk; ia cadangan penulis dokumen ini.
- Tiada nama orang, rahsia atau nama hos dalam dokumen ini.

**Singkatan.** `board` = cawangan `team/r1-board` (kepala `da6e2ad5`), fail di bawah `docs/team/`. `ha24` = cawangan `r1/ha24-release-input`. `ac-gaps` = cawangan `r1/ac-gaps-a1b` (kepala `eda51bf1`).

## Pintu 1. Semua unit READY telah digabungkan oleh B1

| # | Pintu | Bukti | Status | Nota |
|---|---|---|---|---|
| 1.1 | Setiap unit READY digabungkan mengikut susunan B1 | Susunan: `docs/ops/r1-release-input-team-a.md` seksyen 3.5 "Merge order for B1" pada `ha24` (langkah 1 hingga 33, kemudian unit selepas 33). Hasil sebenar: `docs/team/MERGE-LOG.md` pada `board`. | | Seksyen 3.5 ialah **pelan**; MERGE-LOG ialah **rekod**. Bandingkan kedua-duanya. Seksyen 3.5 menyebut `r1/admin-list-perf` @ 2a8ab674 (langkah 10), tetapi kepala semasa ialah `2cd7889a`; guna kepala semasa. |
| 1.2 | Nombor BASE selepas gabungan terakhir | MERGE-LOG, baris BASE terakhir (kolum "Commit on feature/v3-bijak-r1" dan "Merged unit"). | BASE-____ , commit ________ | **Isi nombor ini semasa tandatangan.** Bacaan terakhir sebelum dokumen ini: BASE-105 = `7ea2208c`. |
| 1.3 | Tiada unit READY yang tertinggal | Jadual AUDIT (antara `AUDIT:BEGIN` dan `AUDIT:END`, hujung `docs/team/BOARD.md` pada `board`): setiap cawangan ditandakan READY mesti sama ada dalam MERGE-LOG atau ada sebab ditulis (STALE, SUPERSEDED, ditangguh ke R2). | | Unit sebelum langkah 33 yang ditulis "tidak dalam pelan": `r1/t48-label-move-fix` @ 9783849c, `r1/d90-builder-sweep-a3` @ 6a320636. Unit selepas langkah 33: `r1/delete-served-guard` @ 7e5d82e6, `r1/a4chain-minors` @ 6f2fb793, `r1/r1-chain-qa-a3`, `r1/chain-qa-selfmark-a3`, `ac-gaps`, `ha24`, `r1/ha26-team-a-state`. |
| 1.4 | Cawangan docs bertindih diselesaikan mengikut nota konflik | `docs/ops/r1-release-input-team-a.md` seksyen 3.5, "Conflicts our docs add (A3)". | | Baris `SERVABILITY_OVERVIEW_WARM`: simpan sebelah A3, buang sebelah A4, **jangan simpan kedua-duanya**. Salinan `team-a-r1-state.md` pada `ac-gaps` lebih lama: ambil sebelah `r1/ha26-team-a-state`. |

## Pintu 2. Keputusan B2 dan B3 bagi setiap unit

| # | Pintu | Bukti | Status | Nota |
|---|---|---|---|---|
| 2.1 | Setiap unit yang digabungkan ada keputusan B2 (Approve, atau Approve dengan Minor) | MERGE-LOG, kolum "Merged unit" menulis keputusan dalam kurungan bagi setiap baris. Rekod ulasan penuh: `docs/team/status/B2.md` (dan `B2-C.md`, `C-covers-B.md` bagi unit pasukan C) pada `board`. | | Keputusan tidak diulang di sini dan **tidak boleh disimpulkan** daripada dokumen ini. Baca setiap baris MERGE-LOG. |
| 2.2 | Unit yang menyentuh pengesahan, data peribadi, muat naik fail atau input luar baharu ada B3 (Pass, atau Pass dengan Low) | `docs/team/status/B3.md` pada `board`; MERGE-LOG (rujuk "B3 Pass"). | | Aturan G4 projek: B3 wajib bagi perubahan jenis ini. Unit tanpa B3 yang ditandakan "tiada B3: tiada input baharu" dalam MERGE-LOG (contoh REQ-C-021) diterima atas sebab yang ditulis di situ. |
| 2.3 | Tiada Blocker atau Major B2/B3 yang masih terbuka | `docs/team/status/B2.md` dan `B3.md`; bahagian "Team A routing of B2/B3 verdicts" dalam `docs/team/BOARD.md`; jadual AUDIT bagi baris yang masih tertulis "B2 + B3" (belum disemak). | | Cawangan yang dihantar B1 dengan SHA tepat yang disemak, bukan SHA yang kemudian berubah. MERGE-LOG mencatat "merged by exact reviewed SHA". |
| 2.4 | Minor yang ditangguh dicatat, bukan hilang | Baris "Minors queued" dalam jadual AUDIT (contoh `r1/delete-served-guard`, `r1/reqa018-paper-servability-route`) dan seksyen 5 "Known open items" dalam `docs/qa/r1-b4-qa-handoff.md` pada `ac-gaps`. | | Setiap Minor mempunyai pemilik atau catatan R2. |

## Pintu 3. Keputusan rantaian QA B4

| # | Pintu | Bukti | Status | Nota |
|---|---|---|---|---|
| 3.1 | Pek serah QA B4 telah dijalankan langkah demi langkah | `docs/qa/r1-b4-qa-handoff.md` pada `ac-gaps` (kepala `eda51bf1`): langkah 1 hingga 13, termasuk 3b (Padam), bahagian 4 (semakan dengan tangan, responsif, SELECT UAT) dan 4.4 (429 pada senarai soalan admin adalah dijangka). | | Hasil sebenar B4 belum dalam pek; tulis lokasi laporan B4 di sini: ________ . |
| 3.2 | Peta langkah ke spec | `docs/qa/r1-chain-step-map.md` pada `r1/chain-qa-bab-3a-a3` (kepala `0efba36c`, versi terkini); versi lebih awal pada `r1/chain-qa-selfmark-a3` (`5b93da43`) dan `r1/r1-chain-qa-a3` (`9b70ae39`). Fail ini **tiada** pada `ac-gaps`. | | Peta disahkan pada timbunan setempat yang tidak pernah ditolak (pushed); jalankan semula pada hasil gabungan B1. |
| 3.3 | Keputusan B4 pada BASE selepas gabungan: Ready | `docs/team/status/B4.md` pada `board`; laporan B4 (3.1). | | Bacaan terakhir `B4.md`: E2E pada BASE-102 = **Not ready**, tiada regresi berbanding BASE-98, belum dijalankan semula pada BASE-105. Syarat G5 projek: setiap AC dilaksanakan dan Lulus, tiada pepijat Critical/High yang terbuka. |
| 3.4 | Semakan dengan tangan (tiada bukti backend) | `docs/qa/r1-b4-qa-handoff.md` bahagian 4.1 (FE sahaja dan AC separa, termasuk semakan `t48-label-move-fix`), 4.2 (responsif 375/768/1280), 4.3 (SELECT UAT, baca sahaja). | | Teks BM bagi mesej 409 padam kertas terhold dan "in_use" ditandakan [PROPOSED] dalam pek; sahkan dengan pengguna jika perlu. |

## Pintu 4. Lima had R1 yang diketahui, diterima oleh pengguna

Sumber: `docs/release/r1-nota-keluaran.md` seksyen 2 "Had R1 yang diketahui" dan Catatan hujung N1 hingga N5, pada `ha24`. Pengguna menerima **setiap had** satu demi satu; baris di bawah ialah ringkasan, bukan ganti nota.

| # | Had (ringkas) | Bukti | Status | Nota |
|---|---|---|---|---|
| 4.1 | Tarik balik atau takedown tidak memotong percubaan yang sedang berjalan. | Nota keluaran seksyen 2 butir 1; nota hujung N1 (baris REQ-B-032, B3 NEW-1, dalam `docs/architecture/v2-backend-deviations.md`). | | |
| 4.2 | Kulit kertas mengikut tanda "ditanda oleh orang" yang semasa. | Seksyen 2 butir 2; N2 (baris T52, PIPE AC-20.3, R1 limitation). | | |
| 4.3 | Ruang perlumbaan semasa Terbit: arkib dalam beberapa saat pembacaan sebelum transaksi. | Seksyen 2 butir 3; N3 (baris R1-T34 dalam fail deviations, 2026-11-01). | | N3 sendiri menyatakan baris itu tidak menamakan ruang ini sebagai had; ia bacaan teks baris tersebut, diterima sebagai had R1 oleh keputusan Delivery Lead. Pengguna patut tahu perkara ini. |
| 4.4 | Kadar ganjaran latihan belum disahkan dengan V2. | Seksyen 2 butir 4; N4 (baris "R1-10.1 practice reward rate (R1 limitation)"). | | Berkait dengan soalan terbuka Q12 (pintu 5). |
| 4.5 | Pemadaman boleh dikomit antara bacaan Terbit dan komit penempatan. | Seksyen 2 butir 5; N5 (baris "R1 delete-served-guard" pada `r1/delete-served-guard` @ 7e5d82e6, baris 913, "Known gaps, both KIV"). Kunci `FOR SHARE` ditangguh ke R2. | | Hanya admin; tetingkap sangat sempit. |
| 4.6 | Pengguna telah membaca dan menerima kelima-lima had di atas | Nota keluaran seksyen 2. | | Tandatangan pengguna: penerimaan had-had itu oleh pengguna direkodkan dalam `QUESTIONS.md` pada `board` sebagai Q yang telah diputuskan (tarikh dan petikan jawapan, seperti keputusan Q1 hingga Q11), serta satu baris D dalam `docs/TRACKER.md`. |

## Pintu 5. Soalan pengguna yang masih terbuka

Sumber: `docs/team/QUESTIONS.md` pada `board`. Dibaca sahaja pada kepala `da6e2ad5`.

| # | Soalan | Bukti | Status | Nota |
|---|---|---|---|---|
| 5.1 | **Q12 (TERBUKA, ditanya 2026-11-01 20:00 UTC): ganjaran latihan (Latih Tubi, Databank, Ulang Kaji), R1-10.1.** Q12a: kadar syiling latihan; Q12b: sama ada XP latihan masuk dompet; Q12c: boleh pengguna bekalkan `PracticeRecorder.php` V2 atau pemerhatian .cloud untuk menutup langkah kombo. | `QUESTIONS.md` bahagian Q12; cawangan spec `r1/r1-10-1-practice-spec` @ 488ce41b; nota keluaran seksyen 2 butir 4 dan N4. | | Cadangan pasukan: Q12a kekalkan 1 syiling setiap betul (satu-satunya jumlah yang diperhatikan; 2 ialah andaian); Q12b biarkan seperti sekarang sehingga ada bukti V2. Kod hari ini: 1 syiling setiap betul; 10 mata setiap betul disimpan pada sesi tetapi **tidak** ditambah ke XP dompet. |
| 5.2 | Soalan lain yang terbuka | `QUESTIONS.md`: Q1 hingga Q11 semuanya mempunyai jawapan atau keputusan bertarikh; **hanya Q12 terbuka**. | | Semak semula `QUESTIONS.md` pada kepala `board` semasa tandatangan; soalan baharu mungkin ditambah. |
| 5.3 | Keputusan yang berkait dan tertunggak dalam kod (bukan soalan) | Nota keluaran bahagian 3.4 dalam `docs/ops/r1-release-input-team-a.md` pada `ha24`: D99 (tiada pintu sumber/hak per soalan) dan Q11 (Lapor sebelum hantar pertama pada soalan berstruktur) ialah **diputuskan** tetapi **belum dalam kod** pada BASE-105. | | Sahkan kedua-duanya sudah digabungkan (pintu 1) sebelum menyatakan ia aktif. |

## Pintu 6. Prasyarat deploy

| # | Pintu | Bukti | Status | Nota |
|---|---|---|---|---|
| 6.1 | **Tahap dompet: `select count(*) from tiers` mesti 4.** Jika **bukan 4**, jalankan `deploy.sh --seed-reference` sebelum API menerima trafik. | `docs/ops/r1-runbook.md` §0 butir 6 pada `ac-gaps`; nota keluaran seksyen 4.4 pada `ha24`. | | Tanpa tahap, papan pemuka dan dompet menjawab 500; latihan atau Kuiz yang layak 0 syiling juga 500 dan sesi digulung balik. Bendera hanya memuatkan data rujukan, selamat diulang, dan **bukan** seed demo. Peraturan "bukan 4" ialah keputusan Delivery Lead; runbook masih menulis "jika 0" dan sedang diselaraskan (A2). Semakan `/api/ready` (503 apabila tahap kosong, `r1/ready-tiers-check`) **belum ada kepala**; jangan dikira sebagai perlindungan sehingga ia digabungkan. |
| 6.2 | **Tetingkap penyelenggaraan 0106 dan 0107** (hanya jika `r1/admin-list-perf` @ 2cd7889a dalam keluaran). | Runbook baris 2a dalam bahagian 1 "Order of work" dan bahagian 3.5e (SQL semakan); nota keluaran seksyen 4.1. | | `CREATE INDEX` biasa: tulis ke `question_versions` disekat kira-kira 20 saat (0106) dan 0.9 saat (0107) pada 408k soalan (angka A4); bacaan tidak disekat. Keluar bersama tetingkap 0100. |
| 6.3 | **`pg_trgm` tersedia dan `ANALYZE` dijalankan** | Runbook baris 2a (bahagian 1) dan bahagian 3.5e (SELECT `pg_available_extensions` mesti pulang satu baris); nota keluaran seksyen 4.1 (prasyarat `pg_trgm`). | | Hos terurus mesti membenarkan `CREATE EXTENSION`; jika ditolak, migrasi berhenti di 0106 dan tiada apa yang berubah. `ANALYZE question_versions;` dijalankan sekali selepas 0106 dan 0107 (runbook bahagian 3.5e, tiada kunci eksklusif); `VACUUM ANALYZE question_versions` selepas 0100 ialah langkah 3 dalam bahagian 1. |
| 6.4 | Migrasi 0104 hingga 0107 (dan 0110 jika dimasukkan) digunakan sekali dan mengikut susunan | Runbook bahagian 2 "Migrations and their order"; nota keluaran seksyen 4.1. | | 0104 = T48, 0105 = H-A18, 0106/0107 = `r1/admin-list-perf`, 0110 = `r1/t34-l1-residual-c` @ a2acf754 (pembetulan data, **tidak boleh diterbalikkan**). |
| 6.5 | Pembolehubah persekitaran | Runbook bahagian 6 "Environment" (jadual); nota keluaran seksyen 4.2 dan 4.3; `.env.api.example` dan `apps/api/src/common/config/env.schema.ts` pada cawangan masing-masing. | | Semuanya pilihan kecuali yang tertulis. `SERVABILITY_OVERVIEW_WARM`: kosong atau tidak ditetapkan = hidup di production, mati di tempat lain; **menunggu** `r1/req-b-022a-a4` @ d82c5256. `THROTTLE_QUESTIONS_LIST_PER_MINUTE`: lalai 60 seorang seminit, 429 melebihinya; **menunggu** `r1/admin-list-perf` @ 2cd7889a. `THROTTLE_SERVABILITY_READ_PER_MINUTE`: lalai 120 (dalam base). `THROTTLE_SERVABILITY_OVERVIEW_PER_MINUTE`: lalai 6 (dalam base). `E2E_SEED` **mesti tidak ditetapkan** di setiap pelayan; `ALLOW_DEMO_SEED` tidak pernah `true` di UAT atau production; `BIJAK_POC_QUESTIONS` tidak berfungsi lagi dan patut dibuang. Runbook ada pembolehubah OCR juga. |
| 6.6 | Tiada seed demo di UAT (D95) | Runbook §0 butir 5; QUESTIONS.md Q3. | | Blueprint dicipta dan disahkan oleh Admin Pusat di UAT melalui aliran sebenar. |

## Pintu 7. REQ-A-008 dan T31 digabungkan sebagai pasangan

| # | Pintu | Bukti | Status | Nota |
|---|---|---|---|---|
| 7.1 | `r1/t31-builder-wire` @ eb0346d2 dan REQ-A-008 `r1/reqa008-group-stimulus` @ 29d24be9 digabungkan **bersama**, bukan satu tanpa yang lain | `docs/ops/r1-release-input-team-a.md` seksyen 3.5, langkah 30 ("the pair starts here") dan 31 ("right after T31; vue-tsc 0 from here"). | | |
| 7.2 | `r1/t43-chain-publish` @ 238eb6eb digabungkan **selepas** T31 dan REQ-A-008 | Seksyen 3.5 langkah 32. | | Susunan dalam seksyen 3.5: T31 (30), REQ-A-008 (31), T43 (32), T51 (33). Kata-kata ringkas "T31, T43, T51 selepas REQ-A-008" boleh disalah baca sebagai REQ-A-008 sebelum T31; ikut seksyen 3.5. |
| 7.3 | `r1/t51-partial-acs-a3` @ 61c1b077 digabungkan selepas T48, T31, REQ-A-008 dan T43 | Seksyen 3.5 langkah 33. | | Tidak mengandungi T43b (`r1/t43b-publish-acs` @ 7a14581a, langkah 27, bebas selepas T48). |
| 7.4 | `vue-tsc` lulus pada keputusan gabungan | MERGE-LOG, kolum "Re-run evidence" bagi baris gabungan REQ-A-008 dan selepasnya. | | Seksyen 3.5 menyatakan `vue-tsc 0` hanya dari REQ-A-008 ke atas. |

## Pintu 8. Penggabungan semula FE pasukan C

| # | Pintu | Bukti | Status | Nota |
|---|---|---|---|---|
| 8.1 | **REQ-A-018 FE** `r1/reqa018-paper-servability-fe` (kepala semasa `e6d96462`) telah **digabungkan semula dengan laluan yang dibetulkan** `r1/reqa018-paper-servability-route` @ b7fe6fbc (REQ-A-026) | `docs/team/requests/from-A.md` baris REQ-A-026 dan `docs/team/requests/answers-C.md` pada `board`; BOARD baris `r1/reqa018-paper-servability-route`. | | **Semasa dokumen ini disediakan, `e6d96462` BELUM mengandungi `b7fe6fbc`** (diperiksa dengan `git merge-base --is-ancestor`); ia dibina atas `2f5a85e7`, laluan lama yang ditahan. Laluan baharu: hanya kertas admin, had 200, tambahan `meta:{total,truncated}`; bentuk `{data:[{paperId,title,served,reasons[]}]}` kekal. Tanda hanya selepas kepala FE baharu mengandungi `b7fe6fbc`. Susunan board: laluan A dahulu, kemudian `reqa018-paper-servability-fe`, kemudian cawangan FE C yang lain. |
| 8.2 | **REQ-A-023 FE** `r1/reqa023-ai-draft-delete-409` (kepala semasa `bbb507ea`) digabungkan **selepas** `r1/delete-served-guard` @ 7e5d82e6 | `from-A.md` baris REQ-A-023 dan `answers-C.md` pada `board`. | | Semasa dokumen ini disediakan, `bbb507ea` belum mengandungi `7e5d82e6` (dijangka: cawangan dibina atas BASE-105, gabung selepas). FE memaparkan teks 409 `deleteRefused` (padam tunggal) dan baris `failed[]` CONFLICT (padam pukal); teks BM [PROPOSED] (UX-80, UX-81, UX-82). |
| 8.3 | Selepas gabungan, `vue-tsc` dan ujian unit m04 lulus pada hasil | MERGE-LOG baris gabungan berkenaan. | | |
