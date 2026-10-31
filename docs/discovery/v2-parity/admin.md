# V2 to V3 admin parity audit (re-scoped: Bijak SPM first)

Date: 2026-10-30. Read-only audit. Slug `v2-parity-admin`.
Naming: V1 = prestasiplus.my, V2 = prestasiplus.cloud + admin.prestasiplus.cloud, V3 = the new system (repo "v2"), branch `local/v2-full`.

**Scope (user, 2026-10-30):** secondary students, Bijak SPM first; everything else KIV. Full detail only for admin features that FEED the "Murid 1.0" modules (Bijak SPM / Simulasi, Databank, Tracking A, Mock, Subjektif, Soalan by Chapter, Remedial, Video, Laporan Soalan, Permainan, Heatmap Topik Lemah, Analisa Item, Analitik Adaptif, Prestasi, Headcount, Kelas Saya). Every other admin feature is one row in section 3 marked KIV.

## 0. Sources and method

- V2 routes: `live-cloud/routes.json` (production): `.cloud /admin` 154 GET, `/admin-filament` 147 GET, Panel (admin.prestasiplus.cloud) 23 GET in the file (the brief says 61, probably counting POST/PUT/DELETE; not reconciled). V2 code in `prestasiplus-reference/backend` (controllers, `config/features.php`, `routes/web.php`), `docs/discovery/cloud-student-mechanism.md` section 3, `docs/requirements/v2-cloud-gap.md`.
- V3: `src/shells/pentadbiran/menu.ts` (rendered = built items only), FE routes in `src/modules/*/routes`, FE API clients `src/modules/*/api`, BE controllers `apps/api/src/modules/**` (544 endpoint decorators extracted), pipeline docs `docs/{requirements,design,architecture}/v2-admin-student-pipeline.md`, TRACKER D1-D85.
- "Real BE" = a NestJS route exists and the FE client calls it (`VITE_API_MODE=http`). "Mock only" = FE client/mock exists, no BE route. I diffed the 386 distinct `/api/...` strings in FE against BE routes; the few FE paths with no BE route are in section 4.
- Code-reading only; no browser run. "Pipeline" = `admin-student-pipeline` (G1 D82, G2 D85; D84: built against the real API, no mock).

Legend: ✅ rebuilt and displayed; ⚠️ partial; ❌ missing; 📋 planned in admin-student-pipeline; 🚫 dropped/changed by decision; 🔒 hidden; KIV = out of current scope.

## 1. Feeds-map (admin feature to student module)

| Admin feature | Feeds (Murid 1.0) |
|---|---|
| Studio / Bank Soalan, status Terbit | Latih Tubi, Databank, Soalan by Chapter, Remedial / Aku Salah, Mock, Permainan, Heatmap Topik Lemah |
| Import + review | the same (the only way questions enter) |
| Set Builder / Pembina Kertas / paper publish | Bijak SPM (Simulasi), Simulasi Kuiz, Tracking A |
| Kontrak (blueprint) | Bijak SPM publish gate, Jana Kertas, Mock K1 |
| Tracking A set editor | Tracking A |
| Kertas Subjektif | Subjektif / Kertas Subjektif reader |
| Kurikulum, Bab, Topik, DSKP | Soalan by Chapter, Peta Belajar, Heatmap Topik Lemah, Analisa Item |
| Kawalan Ciri | Permainan, Latih Tubi, Kertas Subjektif (+25 more flags in V2) |
| Laporan Soalan (triage) | student "Lapor soalan", Analisa Item |
| Video admin | Video |

## 2. In-scope features (full detail)

Columns: ID | V2 BM name, menu location, routes | what it does (admin steps, outcome) | V3 status | Real BE or mock | Priority.

### 2.1 Bijak SPM and the question pipeline

| ID | V2 feature | What it does | V3 status | BE / FE reality | Pri |
|---|---|---|---|---|---|
| A01 | **Bank Soalan (Studio)** (title "Studio", subtitle "Bank soalan kanonikal - cipta, semak, terbit"). `/admin` sidebar group Soalan; `/admin/studio`; Panel `Question Studio` `/studio` (edit only, padlock for non-national) | Status tiles (Draft, Reviewed, Approved, Archived), filters (subjek, status, tahun, negeri, kertas, jenis), 25 per page, row actions `Pratonton`, `Edit` / `Edit sebagai draf`. Outcome: the one list of canonical questions every student activity reads. | 📋 S1.1 `/admin/studio` (menu BS-01 to be renamed "Bank Soalan (Studio)"). Today: `Bank Soalan` `/admin/questions` (legacy list) and `Bank Soalan SPM` `/admin/spm/soalan` exist. | Real BE: `GET /api/questions`, `/questions/summary`. `status-counts`, `servability` planned. | P0 |
| A02 | **Cipta baharu / Studio - Cipta soalan** wizard (tabs `Kertas`, `Rangsangan`, `Sub-bahagian`, `Tag`; 13 answer modes; `Simpan draf`). `/admin/studio/questions/create` | Admin writes one question: paper and bahagian, stem, stimulus (TipTap), parts with mode, marks and scheme, bab, topik, kesukaran. Outcome: draft, not visible to students. | ⚠️ V3 has `Tulis Soalan Manual` `/admin/spm/soalan/manual` (KS-16, real `/api/intake/*`) and the legacy form `/admin/questions/create` (`POST /api/questions`). Studio wizard with DSKP/TP tags and `essay_choice` is 📋 S1.2. | Real BE | P0 |
| A03 | **Status flow** on the edit screen: `Hantar untuk semakan`, `Terbitkan` (PublishValidator lists violations), `Arkib`, `Edit sebagai draf`. Flash "Soalan diterbitkan - kini boleh dijawab oleh pelajar." | draft, reviewed, approved, archived. Illegal move: "Peralihan '{from}' -> '{to}' tidak dibenarkan." Outcome: only Approved questions are served to students. | 📋 ADR-0027 (migration 0100 `approved`, `POST /api/questions/:id/status`, `gate-check`, `edit-as-draft`). Today V3 uses `published`, plus Baris Gilir Semakan `/admin/spm/semakan` (KS-15, built) for SPM intake items. | Draft/published real; approved lifecycle not built | P0 |
| A04 | **Pratonton** (Studio preview; Panel `/studio/preview/{q}`) | Shows the question as the student sees it. | ⚠️ `QuestionPreview.vue` in the m28 bank and review pages. "Dilihat murid di" visibility list per activity is 📋 (design section 9). | FE renders from real question read | P1 |
| A05 | **Import DOCX (ZIP)** and **Import BI Kertas 1** modals on Studio | Upload a ZIP or DOCX paper, synchronous import to a DRAFT paper, then `Semak & terbitkan kertas`. | 🚫 changed by D52 / D79(b) / D28(e): V3 intake is PDF upload, then OCR/AI extract, then review. No DOCX ZIP importer. | n/a | P1 (confirm the DOCX path is not needed) |
| A06 | **Muat Naik Kertas** (V3 name; V2 had only CLI `exam:import-ocr-papers`, `exam:ingest-extraction`) | Admin or Guru uploads a paper PDF; pages rendered; text layer / OCR; AI extraction; items land as review items. | ✅ KS-13 `/admin/spm/soalan/muat-naik`, KS-14 `Senarai Ekstrak` `/admin/spm/soalan/ekstrak`. Real `POST /api/intake/batches`, `/batches/:id/files`, `/extract`. On UAT AI_PROVIDER=mock and OCR_ENGINE=none. | Real BE; extraction quality unverified | P0 |
| A07 | **Import & Semakan** (`/admin/studio/imports`; tabs `Kelompok Item`, `Kertas Diimport`, `Kiriman Guru`) | Lists import batches (`Fail Sumber`, `Subjek`, `Bilangan Soalan`, `Disemak`, `Status`, `Semak`). | ⚠️ Batch list = `Senarai Ekstrak` (built). Tab `Kertas Diimport` is 📋 S2.2; `Kiriman Guru` tab links to A10. Menu BS-02 `Import & Semakan` currently points at CSV import `/admin/questions/import`. | Real BE for batches | P0 |
| A08 | **Semak Import, item review** (`/admin/studio/imports/{batch}/review`): PDF pane left, editor right; `Terima (A)`, `Tolak (R)`, `Simpan Sunting (E)`, `Terima semua yang belum disemak` | Admin accepts, rejects or edits each extracted item; accept creates a draft canonical question. | ✅ `/admin/spm/soalan/ekstrak/:batchId` (IntakeReviewPage; stimulus groups, mark-scheme editor). Real `POST /api/intake/items/:id/accept\|reject\|duplicate`, `/items/bulk`, `PATCH /items/:id`. | Real BE | P0 |
| A09 | **Semak kertas / Semak & Terbit** (`/admin/studio/imports/paper/{paper}/review`): blockers banner, `Terbitkan` (confirm "Terbitkan kertas ini? Ia akan terus boleh diakses pelajar di Simulasi."), `Tarik balik ke draf`, override "Terbitkan walaupun tidak memenuhi kontrak blueprint" | Admin previews the imported paper as students see it, sees every blocker, publishes or withdraws. | ⚠️ `Pembina Kertas` `/admin/spm/kertas/:id` (PaperEditorPage) has publish and withdraw with checks (real `POST /api/admin/papers/:id/publish\|withdraw`). Missing: per-row blocker list (AC-07.4), audited blueprint override, student-view render. 📋 S2.4 / S4.4. | Real BE (partial) | P0 |
| A10 | **Kiriman Guru** (`/admin/question-submissions`, download `/{id}/download/{file}`) | Admin sees teacher-uploaded question files, downloads them, imports by hand. | ⚠️ FE page and `PATCH status` client exist (SubmissionListPage). **No BE route** `/api/question-submissions*`: mock only. Teacher intake now runs through intake batches (`INTAKE_TEACHER_ENABLED`, D40). | Mock only | P1 |
| A11 | **Senarai Soalan (legacy bank)** `/admin/questions`: `Tambah Soalan`, `Luluskan Hasil Tapisan`, `Arkib Semua`, per-row `Luluskan` / `Arkib`; filters Subjek, Tahap, Kesukaran, Status, DSKP, Compliance, Source | Admin approves or archives MCQ in bulk or per row so they show or hide for students (also how teacher-contributed `menunggu` questions are approved). | ⚠️ BS-01 list, create/edit, and `POST /api/questions/bulk-action` are real. Bulk by filter with confirm copy, "Sila pilih sekurang-kurangnya satu penapis" guard and `Arkib Semua` is 📋 S3.2. DSKP / Compliance / Source filters unverified. | Real BE | P0 |
| A12 | **Quick Edit** (`/admin/spm/{lane}/{id}/sunting`; Panel `/spm/soalan/{id}/sunting`): stem, option correctness, status radios, McqGate "Soalan ini tidak boleh ditanda seperti sedia ada" | Fast fix of an MCQ; the gate refuses an unmarkable question. | ✅ KS-02 `Bank Soalan SPM` `/admin/spm/soalan`, `/:qid/sunting` (BankEditPage), real `PUT /api/questions/:id`. Servability gate messages are 📋 (ADR-0029/0030). | Real BE | P0 |
| A13 | **Soalan Berstruktur** `/admin/structured-questions` (+ rubric/scheme editor) | Lists and edits structured questions and schemes; feeds Mock K2, Latihan Berstruktur, Subjektif. | ⚠️ FE list and detail exist but are not in the Pentadbiran menu; BE only `GET /api/structured-questions[/:id]`. No edit. v2 folds this into multi-part canonical questions. | Real BE, read-only | P1 |
| A14 | **Kualiti Soalan** (`/admin/questions/quality`) | Audit of question quality (missing answers, duplicates). | ✅ BS-04, real `GET /api/question-quality`, `POST /question-quality/audit`. | Real BE | P2 |
| A15 | **Laporan Soalan (admin triage)** `/admin/question-reports` (also Panel Analitik tile "Laporan Soalan") | Students report a wrong question; admin triages status and notes. Outcome: bad questions are fixed or hidden. | ✅ BS-05, real `GET /api/question-reports`, `PATCH /question-reports/:id`; student `POST /question-reports` and `/laporan-soalan` page built. V2 production had 0 rows. Admin action to hide/archive from the report row: unverified. | Real BE | P1 |
| A16 | **Soalan Gambar** `/admin/soalan-gambar` (V2: redirect) | Questions needing a diagram image: upload or dismiss. | ⚠️ FE route `/admin/soalan-gambar` and real `diagram-audit` endpoints exist; no menu item. Image-held items stay inactive (`image_missing`). | Real BE | P1 |
| A17 | **Sumber Kertas** `/admin/source-papers` (+ `/{id}`) | Provenance registry of source papers. | 🔒 BS-03 hidden; pipeline decision D-10 (not built; provenance lives in intake batches). | n/a | P2 |
| A18 | **Set Builder** (`/admin/studio/sets`, `/pool`, `/{paper}/bank`, `/{paper}/builder`, `/{paper}/documents`; Panel `Pembina Set` `/studio/sets/{paper}/builder`). `Mula kosong` (sections A/B/C), `Jana set` ("Ambil soalan secara rawak", "Kolam soalan"), drag or `Tambah`, rule `Jawab Semua` / `Pilih N`, `Lampir Kertas 2`, `Terbitkan` (pins `question_snapshots`) | Admin assembles a paper from the bank, random by subject/year/state or manual, then publishes. Outcome: the paper appears in Bijak SPM / Simulasi and its questions in Tracking A and Kuiz. | ⚠️ Partial today: `Pembina Kertas` `/admin/spm/kertas` (list, `baharu`, editor; real `/api/admin/papers` list/create/update/preview/publish/withdraw/delete) and student `Jana Kertas` under blueprint (D75/D76). Missing: pool-preview, placements add/reorder, `Salin set`, document attach, snapshot pinning. Set Builder screens are 📋 S4.1/S4.2. UAT has 0 papers. | Real BE (partial) | P0 |
| A19 | **Semak Kertas Simulasi** (Panel `/spm/simulasi-paper/{paper}/review`): `Kemas kini metadata`, `Sunting bahagian`, `Sunting petikan`, `Bahan rujukan (kulit kertas)`, `Tambah soalan`, `Padam soalan`, `Salin set`, `Terbit` / `Sembunyikan` | Fine editing of a native paper; a published paper is read-only ("tekan 'Salin set'"). | ⚠️ PaperEditorPage covers metadata, sections, publish, withdraw. Missing: `Salin set` endpoint, reference-asset panels, soalan tambahan, read-only guard text. 📋 architecture 3.2 (`/copy`, `/placements`). | Real BE (partial) | P0 |
| A20 | **Kontrak Simulasi** (Panel `/spm/kontrak`, no sidebar entry; fields `Kod Kertas`, `Tempoh (minit)`, `Jumlah Markah`, `Sumber` Draf/Spec/Disahkan, `Boleh tanda auto`, `Bahagian` table; delete "Padam kontrak ini?") | Blueprint per subject and kertas: sections, select rules, marks, answer modes. Gates publish (BlueprintConformance); Jana Kertas uses Disahkan only (D76). | ⚠️ **BE ready**: `GET/POST /api/admin/blueprints`, `/:subject/:kertas`, `/versions`, `/retire`; FE `http-admin.ts` reads blueprints. **No admin screen** to create or edit a contract (menu KS-08 hidden). 📋 S7.1-S7.3 with the Disahkan gate. | Real BE, FE page missing | P0 |
| A21 | **SPM hub "Kandungan SPM"** (`/admin/spm`, Panel `/spm`): cards Databank Soalan, Tracking A, Subjektif, Bijak SPM, Kertas Subjektif, Latih Tubi with attention counts ("tidak boleh ditanda", "set tidak lengkap", "tiada skema - tidak disajikan"); lane list `/admin/spm/{lane}` (filters Subjek / Status / Cari; `Pratonton`, `Salin`, `Sunting`) | Shows the admin what blocks each student activity. | 📋 S5.1 / S5.2 (menu KS-01 renamed `SPM`; KS-03/04/05/06 lanes). `GET /api/admin/spm/overview` and `/lanes/:lane` planned; V3 has only the student `GET /api/spm/overview`. | Not built | P0 |
| A22 | **Tracking A set editor** (`/admin/spm/tracking-a/{set}/sunting`; Panel same path; `Isi set`, `tukar`, `buang`, `Simpan`) | Admin fills, swaps and removes questions of each set (target_count) so it becomes playable. V2 CLI `spm:build-tracking-a`. 18 Tracking A sessions in V2 production. | 📋 S5.3, ADR-0032, migration 0104, `/api/admin/spm/tracking-a*`, `/fill`, `/swap`. Today: seed-only sets (`spm_tracking_sets` = 0 on UAT); student `GET /api/spm/tracking-a` only. | Not built | P0 |
| A23 | **Kertas Subjektif** (`/admin/kertas-subjektif`; Panel `/spm/kertas` list, create, edit, `Terbit` / `Sembunyikan` / `Padam`) | Manage Kertas 2/3/4 percubaan negeri; students read when published and flag `kertas-subjektif` is ON. V2 could not upload page images (CLI only). | 📋 S6.1-S6.3, ADR-0033/0034, D81 (upload, OCR, sunting, terbit), migration 0104. Note: V3 `Pembina Kertas` is NOT this feature (V2 Panel `/spm/kertas` is the Kertas Subjektif list). | Not built | P0 |
| A24 | **Tanda Karangan** (Panel `/spm/tanda-karangan`: Skema, Jawapan pelajar, Justifikasi AI, Markah muktamad; only with the essay-grading flag) | Confirm or adjust AI-proposed essay marks. | 🚫 deferred: pipeline AC-10.11 (out of scope until verified); v2-portals Q5 (Guru marks in Pembelajaran); AI hidden by D73. Menu KS-10 hidden. | n/a | P2 |
| A25 | **Kawalan Ciri** (`/admin/feature-toggles`; flash `Ciri "{label}" telah DIAKTIFKAN.` / `DINYAHAKTIFKAN.`; admin only; audit log) | Switch features on/off per audience (pelajar 20 + guru 8 slugs in `config/features.php`: `permainan`, `misi-harian`, `kombo`, `leaderboard`, `remedial`, `video`, `perutusan`, `tiket`, `psikometrik`, `analisa-item`, `prestasi`, guru `headcount`, `kelas`, `monitoring` and more). Hides nav and blocks routes. | 📋 S8.1 minimal (D-8): only `permainan`, `latih-tubi`, `kertas-subjektif`; migration 0105; `GET /api/feature-flags`, `/api/admin/feature-flags/:key`. Gap: about 25 other V2 flags are not modelled (V3 visibility is build-time `features.ts` / `prototype-scope`). Menu SY-02 hidden. | Not built | P0 |
| A26 | **SPM Databank / Ramalan / Ramalan Gred / Set Soalan** (Filament `/admin-filament/spm-databank`, `ramalan`, `ramalan-spm`, `spm-sets`) | Alternative editors over the same SPM sets. | 🚫 merged into A18 / A21 / A22 (D30; v2-cloud-gap F-179). Menu KS-11, KS-12 hidden. | n/a | P2 |
| A27 | **Import CSV** (Filament `/admin-filament/questions/import`; columns `body, option_a-d, correct, [difficulty]`) | Bulk MCQ draft import. | ✅ `/admin/questions/import` and history `/admin/questions/import-history`; real `POST /api/question-imports`, `GET /question-imports`, template. | Real BE | P1 |
| A28 | **Export soalan CSV** `/admin/export/questions` | CSV of the bank. | ❌ no endpoint or button found. | n/a | P2 |
| A29 | **Servability and "Dilihat murid di"** (V2 logic only, no UI) | Shows per question which student activities serve it and why not. | 📋 US-04/05, `GET /api/admin/questions/:id/servability` (V3 addition from D80/D83). | Not built | P0 |

### 2.2 DSKP, curriculum and content that feeds student modules

| ID | V2 feature | What it does | V3 status | BE / FE reality | Pri |
|---|---|---|---|---|---|
| C01 | **Kurikulum** `/admin/curriculum` (Filament Chapters; Topik, Subtopik) | Admin browses and edits Bab, Topik, Subtopik per subject and tahap. Feeds Soalan by Chapter, Peta Belajar, Heatmap Topik Lemah, Analisa Item. | ✅ KK-01 `/admin/curriculum`, chapter and topic create/edit routes; real `/api/admin/curriculum/{chapters,topics,subtopics}` CRUD. Menu KK-03 `Bab` is listed hidden although the screens exist under Kurikulum. | Real BE | P0 |
| C02 | **Subjek** `/admin/subjects` | Subject CRUD and active flag. | ✅ KK-02, real `/api/admin/subjects*`. | Real BE | P0 |
| C03 | **Tahap Pendidikan** `/admin/education-levels` | Level CRUD. D72 hides Darjah (inactive); Tingkatan 1-5 stay. | ✅ KK-04, real `/api/admin/education-levels*`. | Real BE | P1 |
| C04 | **DSKP tagging data** (no V2 admin screen; `curriculum_nodes`, TP, Bidang/SK/SP; filter "Ada DSKP Tag / Belum Ditag"; "Belum ditanda DSKP") | DSKP tree used to tag questions; blueprint papers and Jana Kertas require `dskp_complete`. | ⚠️ Read-only lookups `GET /api/guru/dskp/{bidang,sk,sp}`; question forms take tags. **`curriculum_nodes` = 0 on UAT**; no DSKP loader or editor. Pipeline: migration 0101 adds `tp`, `cognitive_level`, `question_version_facts`; D80(1) legacy MCQs stay servable until tagged. | Real BE lookups; data missing | P0 |
| C05 | **Video** (Filament `/admin-filament/videos`; no Blade page) | Admin (and uploaders) add, edit, delete lessons per subject and bab. Feeds Video. | ⚠️ Real CRUD `GET/POST/PUT/DELETE /api/videos`, `/videos/form-context`; FE `/video/tambah` and `/video/:id/edit` in the user shell (uploader or admin). Pentadbiran items KK-08 `Video` and KK-12 `Video Sekolah` not built: no admin list or moderation inside Pentadbiran. | Real BE | P1 |
| C06 | **Nota / Artikel / Banner** (supporting content; Nota feeds Buku Nota) | CRUD of notes, articles, banners. | ✅ KK-05/06/07, real `/api/admin/{banners,articles,notes}`. | Real BE | P2 |
| C07 | **Tetapan Permainan / Games** (`/admin/permainan`, Filament Games) | `boardgame_quiz_tiles` and games settings. Feeds Permainan. | ⚠️ BE `GET /api/admin/games`, `PUT /api/admin/games/settings` and FE client `fetchAdminGames` exist; **no page, no route** (PG-11 hidden). The `permainan` flag is covered by A25. | BE ready, FE page missing | P1 |

## 3. KIV rows (out of current scope): one row per feature

"V3 now" is informational only.

| # | V2 BM name | V2 location and route | V3 now | Status |
|---|---|---|---|---|
| K01 | Papan Pemuka / Dashboard | /admin, Panel `/`, Filament Dashboard | not built (`/admin` redirects to Command Center) | KIV |
| K02 | Laporan Eksekutif | /admin/laporan-eksekutif | partial: M18 page `/amaran/ringkasan-eksekutif`, not in menu | KIV |
| K03 | Laporan (aktiviti) | /admin/laporan | not built | KIV |
| K04 | Analitik | /admin/analytics, Panel `/analitik` | not built | KIV |
| K05 | Command Center, Aktiviti Harian | /admin/command-center(+/daily-activity, /live) | built, real BE | KIV |
| K06 | Monitoring (+ CSV/PDF) | /admin/monitoring | built, real BE | KIV |
| K07 | Kirkpatrick (7 pages, PDF) | /admin/kirkpatrick/* | built, real BE | KIV |
| K08 | Prestasi Sistem, Server Status | /admin/performance, /admin/server-status | not built | KIV |
| K09 | Pengguna (list/create/edit/bulk/packages) | /admin/users*, Panel `/pengguna`, Filament Users | built, real BE (impersonate: BE 404 by design, UD-2) | KIV |
| K10 | Import Pengguna / Import Pelajar | /admin/users/bulk-import, /admin/import-students | built, real BE | KIV |
| K11 | Pelajar Komplimen | /admin/comp-students | built, real BE | KIV |
| K12 | Sekolah (toggle, kod pendaftaran) | /admin/schools*, Panel `/sekolah` | built; rotate join code not found | KIV |
| K13 | Langganan Sekolah | /admin/school-subscriptions* | built, real BE | KIV |
| K14 | Pembayaran | /admin/payments | not built | KIV |
| K15 | Billing Dashboard | /admin/billing | not built | KIV |
| K16 | Invois | Filament invoices | renewal-invoice page only | KIV |
| K17 | Dunning Log | /admin/dunning | not built | KIV |
| K18 | Tetapan (limits, pricing, gateway keys, branding, SPM target override) | /admin/settings | not built | KIV |
| K19 | Log Audit (+CSV) | /admin/audit-logs, /admin/audit-log/export | not built; no BE audit endpoint | KIV |
| K20 | Push Notifikasi | /admin/notifications | not built (user inbox only) | KIV |
| K21 | Chatbot (analytics, knowledge, conversation) | /admin/chatbot* | not built; ALESA hidden (D73) | KIV |
| K22 | Tiket Bantuan (queue) | /admin/tiket | built read-only (D27), real BE | KIV |
| K23 | Gamifikasi: Overview, Tier Config, Cabaran, Pelajar, Transaksi | /admin/gamification/* | BE ready; FE client and mock only, no pages | KIV |
| K24 | Kedai Hadiah / Hadiah, tebusan | /admin/hadiah | BE ready, no FE page | KIV |
| K25 | Kawalan Reward, Cabutan Bertuah | /admin/reward-control, Filament lucky-draws | BE ready for reward-control; no FE page | KIV |
| K26 | Gamifikasi Guru, Lencana Guru, tebusan/tunai | /admin/gamifikasi/guru* | FE client only, no BE route | KIV |
| K27 | Marketplace Produk, Penjual | /admin/marketplace/* | not built (public read only) | KIV |
| K28 | Penajaan, Anak Angkat, Permohonan Anak Angkat | /admin/sponsors, /admin/anak-angkat* | not built; student page hidden D74 | KIV |
| K29 | Permohonan Duta | /admin/duta-applications | not built (student duta endpoint only) | KIV |
| K30 | Psikometrik (flag `psikometrik`; no admin page in V2) | n/a | not built | KIV |
| K31 | Soalan PKSK, Akses PKSK | /admin/pksk/* | built, real BE | KIV |
| K32 | Audio KBAT admin | /admin/audio-kbat* | built, real BE | KIV |
| K33 | Perutusan, Panduan | student pages and flags | compose via `/api/perutusan`; no admin list | KIV |
| K34 | Laluan Kerjaya, Universiti, Biasiswa | Filament career-paths, universities, scholarships | not built | KIV |
| K35 | Upload Screenshot | /admin/tools/screenshots | built, real BE | KIV |
| K36 | Exports: users, payments, schools, audit CSV | /admin/export/* | not built (monitoring CSV and Kirkpatrick PDF exist) | KIV |
| K37 | PPD / JPN portal (officer role) | `/admin/pemantauan/{wilayah,negeri}` | "Belum tersedia" page; no officer screens | KIV |
| K38 | Admin Sekolah screens | (V3 `/admin-sekolah/*`) | built M27, real BE | KIV |
| K39 | Impersonate / Pratonton sebagai Pelajar | ImpersonateController | FE calls it; BE absent by design | KIV |
| K40 | Panel Pengguna `activate`, Sekolah toggle | Panel `/pengguna`, `/sekolah` | covered by K09 / K12 | KIV |

## 4. Verification notes (FE vs BE)

- FE `/api/...` paths with no BE route: `/api/question-submissions` (+ `/status`, `/files/:i`), `/api/admin/users/:id/impersonate` (BE says 404 by design), `/api/admin/gamification/guru/*` (teacher badges, rewards, redemptions, cash), `/api/me/parent-invite/generate`, `/api/admin/config/defaults` (route form unverified).
- BE routes with no FE page: `/api/admin/blueprints*` (edit), `/api/admin/games*`, `/api/admin/gamification/*`, `/api/admin/hadiah*`, `/api/admin/reward-control*`, `/api/ai/*`, `/api/admin/parent-links`.
- V3 extras with no V2 equivalent: `Baris Gilir Semakan` (KS-15), `Muat Naik Kertas`, `Tulis Soalan Manual`, `/api/ai/*` settings.

## 5. Counts

In scope: 36 rows (A01-A29, C01-C07). KIV: 40 rows (K01-K40).

| Status | Count | Rows |
|---|---|---|
| ✅ rebuilt and displayed | 10 | A06, A08, A12, A14, A15, A27, C01, C02, C03, C06 |
| ⚠️ partial | 14 | A02, A04, A07, A09, A10, A11, A13, A16, A18, A19, A20, C04, C05, C07 |
| ❌ missing | 1 | A28 |
| 📋 planned in admin-student-pipeline | 7 | A01, A03, A21, A22, A23, A25, A29 |
| 🚫 dropped / changed by decision | 3 | A05 (D52, D79b, D28e), A24 (AC-10.11, Q5, D73), A26 (D30) |
| 🔒 hidden | 1 | A17 |
| KIV | 40 | K01-K40 |

Reading: several ⚠️ rows (A02, A07, A09, A11, A18, A19, A20) are partial because their pipeline completion is still planned; the pipeline therefore covers 14 of the 36 rows in full or in part. Of 36, 10 are done, none of the Bijak SPM publishing chain (Set Builder, Kontrak screen, Tracking A, Kertas Subjektif, Kawalan Ciri) is complete.

## 6. Top 20 gaps, Bijak SPM first

1. **A25 Kawalan Ciri** (P0): build migration 0106, `GET /api/feature-flags`, `GET/PUT /api/admin/feature-flags/:key`; FE `/admin/feature-toggles` (SY-02). Decide about the other ~25 V2 flags.
2. **A03 Question lifecycle `approved`** (P0): ADR-0027 in `apps/api/src/modules/questions`; status bar on the edit screen (`Hantar untuk semakan`, `Terbitkan`, `Arkib`, `Edit sebagai draf`).
3. **A18 Set Builder / Jana set** (P0): `POST /api/admin/papers` mode generate or blank, `pool-preview`, placements, snapshot pinning on publish; FE `/admin/studio/sets*`. UAT has 0 papers, so Bijak SPM is empty until papers exist.
4. **A20 Kontrak Simulasi screen** (P0): BE `admin/blueprints` is ready; build `/admin/spm/kontrak` list and editor with `Sumber` Draf/Spec/Disahkan and the Disahkan gate (D76).
5. **A01 / A02 Studio list and wizard** (P0): `/admin/studio` and `/admin/studio/questions/create` with DSKP/TP tags, `essay_choice`, stimulus kinds (m04 or m28 admin).
6. **A29 Servability engine and "Dilihat murid di"** (P0): `ServabilityService.where(activity)`, per-question report, attention counts.
7. **A22 Tracking A editor** (P0): migration 0104, `/api/admin/spm/tracking-a*` (fill, swap, save), FE `/admin/spm/tracking-a/:set/sunting`; currently seed-only, 0 sets on UAT.
8. **A21 SPM hub and lanes** (P0): `GET /api/admin/spm/overview|lanes/:lane`; FE `/admin/spm` and `/admin/spm/{lane}`; rename KS-01.
9. **C04 DSKP data** (P0): `curriculum_nodes` and `question_version_sp_nodes` are 0 on UAT; load DSKP and give admin a way to tag or edit (blueprint papers and Jana Kertas depend on it).
10. **A23 Kertas Subjektif** (P0): migration 0105, upload, OCR, sunting, terbit (D81), `/admin/kertas-subjektif*`, student reader; set `OCR_ENGINE`.
11. **A06 Extraction quality** (P0): UAT uses AI_PROVIDER=mock, OCR_ENGINE=none; decide the real provider and engine (Tesseract recommended, U1) before admins rely on Muat Naik Kertas.
12. **A19 Paper review extras** (P0): `Salin set` (`POST /api/admin/papers/:id/copy`), reference assets, soalan tambahan, read-only guard text in PaperEditorPage.
13. **A09 Semak & Terbit blockers** (P0): AC-07.4 blocker list, audited blueprint override, "Tarik balik ke draf" copy.
14. **A11 Bulk approve/archive by filter** (P0): `Luluskan Hasil Tapisan` and `Arkib Semua` with exact V2 copy; v2 `bulk-action` contract (limit 2,000).
15. **A07 Import & Semakan tabs** (P0): `Kertas Diimport` and `Kiriman Guru`; repoint BS-02 to the intake list.
16. **A10 Kiriman Guru** (P1): add the BE `/api/question-submissions*` or fold into intake batches; today mock only.
17. **C05 Video in Pentadbiran** (P1): add KK-08 admin list and delete using existing `/api/videos`.
18. **C07 Tetapan Permainan page** (P1): BE is ready; add PG-11 page and route.
19. **A15 Laporan Soalan row action** (P1): confirm or add hide/archive of the reported question.
20. **A16 Soalan Gambar menu** (P1): expose `/admin/soalan-gambar` in the menu (image-held items stay inactive until fixed).

## 7. Unverified items

- End-to-end behaviour of Muat Naik Kertas with a real provider (UAT: mock AI, no OCR).
- Whether intake item review has V2's shortcuts A/R/E and `Terima semua yang belum disemak`.
- Whether the legacy list filters DSKP / Compliance / Source exist in `QuestionListPage`.
- Whether Laporan Soalan row actions can archive the question.
- Student-visible effect of V2 flags beyond the 3 pipeline flags; production state of `latih-tubi`, `kertas-subjektif`, `tracking-a-canonical-*`, `legacy-retirement` (cloud-student-mechanism section 5).
- Panel route count (23 GET in file vs 61 in brief).
- Whether DOCX ZIP import (A05) is still wanted; production data came from CLI OCR import.
- DSKP admin: V2 has no admin screen; assumed loaded by seed or ETL.
- Statuses are from code reading, not from running V3.
