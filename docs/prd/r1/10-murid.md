# SRS — Murid portal (R1)

> **UI rule (D115, 40 FR-X1-6).** Screen specifications "from V2" define fields, actions, rules, copy and states, not layout. V3's existing layout, components and navigation win; never restyle a screen to look like V2.

> **Read this first.** V3 already exists. Each module's *Action* and *Current gap* say what to change. The *Screen specification* describes the target behaviour; it is **not** an instruction to rebuild the screen. Before coding a card: (1) run a code gap check of the existing V3 code against every FR/AC of the card and post it on the issue (FR/AC → works / broken / missing, with file:line); (2) change only what is broken or missing, in the existing files; (3) prove the ACs, including the AC-CHAIN that passes through the module.

| Item | Content |
|---|---|
| Purpose | Software Requirements Specification of the Murid (secondary-school pupil) portal of PrestasiPlus V3, Release 1.0. A developer builds from it and a tester verifies from it, without opening V1 (prestasiplus.my) or V2 (prestasiplus.cloud) and without screenshots. |
| Scope | 41 Murid modules (plus the shared sign-in block 3C): the 18 Release 1.0 rows (section 3), the 23 other matrix rows (section 3B), the shared sign-in screens (section 3C), the shared shell (section 2) and the cross-module rules (section 4). Each module carries a "Screen specification (from V2)" that describes the screen in words. Admin, teacher and parent portals are out of scope here. |
| Roles involved | Murid (pupil, T1-T5), the owner of this portal; Guru (class sets, headcount targets, tickets), Admin Sekolah and Admin Panel (content, packages, rewards, ticket replies) as feeders of pupil data; Ibu Bapa (invite link). |
| Related documents | [00-index](00-index.md), [01-product-overview](01-product-overview.md), [02-urs](02-urs.md), [40-cross-cutting](40-cross-cutting.md), [50-data-model-erd](50-data-model-erd.md), [60-api-contract](60-api-contract.md) |

- Slug: `r1-prd-murid` (feature slug `r1-prd-devplan`). Language: English; every UI string is quoted in exact Bahasa Melayu (BM). Redacted names in V2 pages are written as "pupil name"; no real person, school-tied ranking or credential appears in this document.
- Date: 2026-11-04. Branch: `docs/r1-prd-devplan`. Author role: Product Analyst (what and why only).
- Governing principle (user): **"berdasarkan V2+V1 untuk betulkan V3"**. V2 (prestasiplus.cloud) is the primary reference for navigation, flow, timers, result layout and BM copy. V1 (prestasiplus.my) is the fallback where V2 lacks the module or is broken.
- **Correction of 2026-11-04 (user), applied throughout:** V2's question structure does not follow the DSKP. For how a pupil **sees and answers** questions (SPM, Bijak SPM, Latih Tubi, Soalan by Chapter) the reference is NOT V2's rendering where they differ. The sources are `docs/requirements/v2-exam-schema.md` (approved, D46/D47), `v2-question-bank.md`, `v2-question-bank-oldsystem-findings.md`, and decisions D41, D90, D97, D105 (D92's text-only restriction is superseded by D105). V2 is taken only for navigation, flow, timers, result layout and BM copy where these do not conflict. Each difference is logged as a fidelity deviation (FD) with its source. The single contract is in section 4.6.
- User decisions of 2026-11-04 (TRACKER D100-D108): every matrix-ticked module must be fully working (no stub, no dead link, no flag that switches a ticked feature off). Delivery order (D106): the 1.0 columns (section 3) first, then the rest of the matrix (section 3B: A4 and rows 17-36, 38-40); any module a 1.0 screen links to is delivered with 1.0 and is marked "1.0 (linked from R1-MUR-x)". Rows 15 and 37 stay hidden and their URL returns the standard 404 (D102, D108(6)). T1-T5 everywhere (D101). SPM includes Subjektif and Kertas Subjektif with self-mark (D104). Drills serve figure questions and whole stimulus groups (D105).
- Names: V1 = prestasiplus.my, V2 = prestasiplus.cloud (+ admin Panel), V3 = the new build (repo docs call it "v2"). UAT = uat.prestasiplus.cloud.
- Evidence: gap analysis of V3 against V2 (observed 2026-11-04, read only), V2 page text, V2 reference code, `docs/discovery/*`, V3 code. The V2 pages are written out in words in each module's "Screen specification (from V2)"; developers do not open V1 or V2 and no screenshots are part of the spec. Privacy: no real person name appears here; roles only.

---

## 0A. Shared rules (apply to every module below)

Every module has a "Field & behaviour spec" block after its "Screen specification". A developer builds every control from that block without asking a question. Where a module block and this section disagree, the module block wins for that module only.

**Table columns.** `Label` is the exact BM text. `Type`, `Req` (Ya/Tidak), `Default`, `Options / source` (an option-set ID of section A1 or the full list), `Validation + BM error`, `Depends on`, `Stored as`, `API` (an API-ID of 60, or the route; "new" = added in section A2).

**0A.1 Errors.** Every error text, toast, banner and page follows the ERR catalogue in `40-cross-cutting.md` section X10. A module line cites the ERR-ID and does not repeat the text unless the text is module specific. The global behaviour (all screens):

| Situation | ERR-ID | What the pupil sees and what is kept |
|---|---|---|
| Offline or no response | ERR-NET-01, ERR-NET-03 | Amber banner, not blocking; the typed input is kept; green banner for 3 s on recovery. On answering screens the banner text of 46 section 2.6 is used (answers kept on the device). |
| Timeout (30 s for JSON calls, 60 s without upload progress, 120 s for export) | ERR-NET-02 | Toast with "Cuba Semula"; typed input kept; a retried write reuses the same key (`clientUuid`, `rev`, idempotency key) so it cannot apply twice. |
| 400 / 422 | ERR-REQ-01, ERR-REQ-10..16 | The text of `fields.{name}` under the field (red, `aria-describedby`); summary line `{n} medan perlu dibetulkan.`; typed input never cleared; focus goes to the first invalid field. |
| 401 | ERR-AUTH-01 | `Sesi anda telah tamat. Sila log masuk semula.`; go to `/login?kembali={path}`; the local answer mirror (`pp.bijak.local.{attemptId}` in V3) is kept (only Log Keluar clears it); after login the pupil returns and unsent changes replay. A login 401 uses ERR-AUTH-02. |
| 403 | ERR-ACC-01 | The standard 403 page with "Halaman Utama"; `PASSWORD_CHANGE_REQUIRED` goes to the password page (ERR-AUTH-07). |
| 404 / hidden module | ERR-ACC-02, ERR-ACC-03 | One page for another pupil's id, an unknown id and a hidden module (no existence leak). |
| 409 | ERR-CON-01 or the module code | The module message when the module has one; else ERR-CON-01 with "Muat Semula". |
| 429 | ERR-RATE-01 | `Terlalu banyak percubaan. Sila cuba sebentar lagi.` plus `Cuba lagi dalam {s} saat.`; the submit button is disabled until 0; autosave retries after `retryAfter`. |
| 5xx | ERR-SYS-01 (write), ERR-SYS-01b (read) | Toast (write) or an error card with "Cuba Semula" (read). Never a blank screen; one failed block shows its own card while the other blocks render. |
| Loading | - | Page skeleton that matches the layout; `Memuatkan...` for screen readers; content stays visible during a refetch; a button changes its label while sending ("Menyimpan...", "Menghantar...", "Menyemak..."); after 8 s add `Masih memuatkan. Sila tunggu sebentar.` |
| Empty | - | The module's own empty copy; a module without one shows `Tiada data untuk dipaparkan.` (R1 decision D113). No "akan datang". |

**0A.2 Option sets.** The master list of option sets is `40-cross-cutting.md` section X11. Section A1 of this file lists the sets this file uses (it follows X11; X11 wins on a difference).

**0A.3 Display name.** Another pupil is shown by first given name only (D113), with no initial, surname, school, class or photo (section 4.3); two pupils with the same first name look the same, which is accepted. The pupil's own row is marked "ANDA".

**0A.4 Accuracy and rounding.** "Ketepatan" everywhere is pooled: correct answers divided by answered, over all modes in `practice_answers`, shown as a **whole number, rounded half up** (86.67 shows 87), "-" or "—" when there are 0 answers. A self-marked part counts as correct only at full marks. The mean of session accuracies is a different measure ("Skor Purata") and is never labelled "Ketepatan". Storage may keep decimals; display never does (Headcount "Manual AR" keeps one decimal because the teacher keyed it). On the wire every accuracy field of a practice or report API is a number with one decimal (pooled correct ÷ answered × 100, for example 86.7), and the screen rounds that value half up to the whole number (D-T10-1, 40 XS-5).

**0A.5 Dialogs.** Every confirm dialog is modal, puts focus on the safe button, treats Esc and an outside tap as the safe choice, shows the "-ing" label on the primary button while sending, stacks its buttons at 375 px (each at least 44 px) and names the action with a verb, never "OK" or "Ya". The exact dialog copy is in the module block (and 46 section 2.8 for activities).

**0A.6 URL state.** Every filter, tab and page number is in the query string so Back and refresh restore it.

**0A.7 Dates and times.** Month names are BM ("23 Okt 2026, 08:06 PM"); relative dates are BM ("{n} bulan lalu"); every day, week and month boundary is Asia/Kuala_Lumpur.

**0A.8 End-to-end activity flows.** The flow of every activity (setup, answering, marking, submit, result, rewards, stored rows, reports) is normative in `46-pupil-activity-flow.md`; games are normative in `48-game-and-gamification-spec.md`. A module block lists only the fields specific to the module and points to the section.

**0A.9 Password.** The minimum is 8 characters (maximum 200) wherever a password is SET (register, reset, change; K1, D-A17); login only requires a non-empty password so older accounts can still sign in. Message: `Kata laluan mestilah sekurang-kurangnya 8 aksara.`; hint: "Minimum 8 aksara".

**0A.10 Autosave.** Every answering screen that saves while typing uses an 800 ms debounce, a flush on blur and on question change, a local mirror, and a fixed 5 s retry (ERR-SAVE-01; D-PA-16). Status words: "menyimpan…", "disimpan", "luar talian", "gagal simpan".

**0A.11 Stimulus groups and duplicated stems.** A stimulus group (1..n questions, 1 to 3 stimuli, part-level stimulus allowed) is published, served and retired as ONE unit and is shown once; a question whose stimulus is missing (`stimulus_missing`, `figure_only`) is not served; a duplicated stem is shown once and is NOT excluded (D113).

**0A.12 Rewards and coins.** The Syiling rate is an admin setting, default 1 (section 4.4); game coins are a separate admin setting, default off (section 4.4a).

---

## 1. Purpose and scope

### 1.1 Purpose
A secondary-school pupil (Tingkatan 1-5; practice content for every form where questions exist, D101) uses the Murid portal to practise, sit SPM-style papers, see own performance, report wrong questions and keep an account. This part defines the Murid portal for Release 1.0 so a developer can build and a tester can verify it without guessing.

### 1.2 In scope: the 18 Murid 1.0 rows

Source: `docs/Matriks-Akses-Peranan .xlsx`, sheet "Matriks Akses", column Murid 1.0, plus Latih Tubi (row 16) added by the user.

| ID | Row | Module (menu label) | Route | Priority |
|---|---|---|---|---|
| R1-MUR-A1 | A1 | Profil Saya | `/profile` | P1 |
| R1-MUR-A2 | A2 | Tetapan Peribadi | `/tetapan` | P1 |
| R1-MUR-A3 | A3 | Panduan | `/panduan` | P2 |
| R1-MUR-A5 | A5 | Log Keluar | `POST /api/auth/logout` | P0 |
| R1-MUR-2 | 2 | Dashboard | `/dashboard` | P1 |
| R1-MUR-3 | 3 | Headcount | `/headcount`, `/headcount/student/:ownId` | P0 |
| R1-MUR-4 | 4 | Prestasi | `/prestasi` | P0 |
| R1-MUR-5 | 5 | Analitik Adaptif | `/analitik/pelajar` | P1 |
| R1-MUR-6 | 6 | Analisa Item | `/analisa-item` | P0 |
| R1-MUR-7 | 7 | Video | `/video` | P2 |
| R1-MUR-8 | 8 | Kelas Saya | `/kelas-saya` | P1 |
| R1-MUR-9 | 9 | Soalan by Chapter | `/practice/chapter` | P0 |
| R1-MUR-12 | 12 | Remedial | `/remedial/saya` | P1 |
| R1-MUR-13 | 13 | SPM (Bijak SPM / Simulasi, Databank, Tracking A, Subjektif) | `/spm`, `/spm/bijak` | P0 |
| R1-MUR-14 | 14 | Heatmap Topik Lemah | `/buku-nota/heatmap` | P1 |
| R1-MUR-16 | 16 | Latih Tubi | `/practice` | P0 |
| R1-MUR-21 | 21 | Permainan | `/permainan` | P1 |
| R1-MUR-54 | 54 | Laporan Soalan | `/laporan-soalan` | P0 |

Priority: P0 blocks 1.0, P1 important, P2 polish. Matrix order: A1, A2, A3, A5, 2, 3, 4, 5, 6, 7, 8, 9, 12, 13, 14, 16, 21, 54.

### 1.2b Action per module (FR-X1-5: close, fix and improve the gaps only; never rebuild)

Only the listed gaps are changed; the existing screen, routes and API are reused (FR-X1-5). Each module section starts with its Action and a "Current gap and root cause" change list. **Keep** = matches V2 already, verify the ACs only. **Fix** = existing code is wrong. **Complete** = partly built. **Build** = missing.

| Action | Modules | Count |
|---|---|---|
| Keep | A5, 7, 20, 27, 29, 30, 34, 40 | 8 |
| Fix | A3, 4, 8, 9, 14, 16, 21, 54, 18, 24, 25, 26, 35, 36 | 14 |
| Complete | A1, A2, 2, 3, 5, 12, 13, A4, 17, 19, 22, 23, 28, 31, 32, 33, 38, 39 | 18 |
| Build | 6 | 1 |
| **Total** | | **41** |

By part: the 1.0 columns have 2 Keep, 8 Fix, 7 Complete, 1 Build (18); the rest of the matrix has 6 Keep, 6 Fix, 11 Complete, 0 Build (23).

Actions changed by the dev-readiness audit (2026-11-04): 8 Kelas Saya (remove the join-by-code box, D-A8), 14 Heatmap (per-subject Bab rule), 21 Permainan (question-based games write the single answer store), 26 Set Soalan Guru (mode `question_set`, 404, assigned class), A4 Tiket Bantuan (single admin reply). Each was "Keep" before; the others stay as listed.

### 1.3 The rest of the matrix: every other Murid row (full sections in 3B)

User decisions of 2026-11-04 (TRACKER D100-D108): **every module ticked in the matrix must be fully working** (no "Pratonton", no "akan datang", no "belum tersedia", no prototype page, no mock data, no dead button, no dead link). Delivery order: the 18 rows above first, finished in depth; then **every other Murid row of the full column: A4 and rows 17-36, 38-40**, specified with the same template and depth in section 3B (23 modules). Per D106, a module that a 1.0 screen links to is delivered with 1.0 and marked "1.0 (linked from R1-MUR-x)": Soalan Berstruktur (17, from 13), Kedudukan (18, from 33), Artikel (20, from 2), Tournament (23, from the shell banner), Set Soalan Guru (26, from 2 and 8), Syiling & Token (28, from the header coin pill and 2), Tukar Token (29, from 28), Cabaran Harian (30, from 2 and 28), Kedai Hadiah (31, from 28), Papan Pendahulu (33, from 8 and 18). **Exceptions (D102): row 15 Mohon Keluarga Angkat and row 37 Cikgu Alesa stay hidden** (one line each below). The earlier "hidden, not deleted" plan for the other rows is withdrawn; hiding now applies only to the two exceptions and to V2 extras with no matrix row (last paragraph). The table gives the current V3 state of each of these rows, as found by the gap analysis; the full specification is in 3B.

| Row | Module | Current V3 state (GitHub / UAT) |
|---|---|---|
| A4 | Tiket Bantuan | Built; same as V2 (status filter, "Tiket Baru"). Hidden from account menu and sidebar. |
| 15 | Mohon Keluarga Angkat | **Stays hidden (D74, D102)**: `VITE_KELUARGA_ANGKAT` off, 404. One line only; no section. |
| 17 | Soalan Berstruktur | Built (3 seed sets); also the answer screen reached from SPM > Subjektif. |
| 18 | Kedudukan | Built; "Tiada data kedudukan" even with coins; V2 has own-rank card. |
| 19 | PKSK | Built; open to demo account. |
| 20 | Artikel | Built (+ "Paling Hangat"). The dashboard "Artikel Untuk Kamu" panel is part of Dashboard, see R1-MUR-2. |
| 22 | Cabutan Bertuah | Built (demo draw, ticket purchase). |
| 23 | Tournament | Built (empty). V2 has none. |
| 24 | Topik | Built; UAT "akan datang" for T1, empty for T5 (no DSKP map). |
| 25 | Peta Belajar | Built; UAT 0/0. |
| 26 | Set Soalan Guru | Built; empty state. |
| 27 | Audio KBAT | Built; empty state. |
| 28 | Syiling & Token | Built; V2 hub has Kedai Hadiah Digital catalogue, V3 hub lacks it. |
| 29 | Tukar Token | Built (50/250/Semua). |
| 30 | Cabaran Harian | Built (10 challenges; V2 15). |
| 31 | Kedai Hadiah | Built; catalogue empty ("Tiada Hadiah Tersedia"). |
| 32 | Marketplace | Built; sample products. |
| 33 | Papan Pendahulu | Built; no period or scope filter. |
| 34 | Pencapaian | Built (25 badges). |
| 35 | Kotak Misteri | Built; model differs from V2 (4 token boxes vs 1 coin box). |
| 36 | Rujuk Kawan | Built; reward rule differs (50/25 vs 100). |
| 37 | Cikgu Alesa | **Stays hidden (D73, D102)**: `VITE_ALESA_AI` off, 404. One line only; no section. |
| 38 | Kedai Hadiah DIGITAL | Built; empty catalogue. |
| 39 | Timeline Saya | Built; manual posts, V2 is an automatic feed. |
| 40 | Jemput Ibu Bapa | Built; same as V2. |

Also hidden (no matrix row, present in V2 or V3 code; not covered by D100 because they are not ticked in the matrix): Target SPM, Kombo page, Laporan Mingguan, Notifikasi, Sekolah Bersaing, Pembetulan, Penguasaan, Kemajuan Saya, Sejarah Latihan, SPM Mock Exam (`/spm-mock` redirects to `/spm/bijak`, D113), Cita-Cita group, Nota Ringkas pages other than the heatmap, Psikometrik, Profil Cerah, Bilik Duta, Wellbeing/Mood Saya, Pusat AI tools. The Dashboard widgets that live inside row 2 (Kombo card, daily missions) remain, see R1-MUR-2.

**Misi Harian and Soalan Aku Salah are SERVED, not hidden (D115, matrix-audit MX-4; rule: V3 already has both and 46 requires them).** (1) **Misi Harian:** the teacher's missions (matrix row GUR-2b, FR-GUR-2b-*) must reach pupils, otherwise teachers create missions nobody can play. V3 routes kept: `/misi-harian` (list) and `/misi-harian/:id` (drill, mode `mission`) (`src/modules/m05-practice/routes/remedial.ts:36,48`; 46 and 48 name them `/misi`, `/misi/:id` after V2; the V3 paths win and the docs mean V3's). Entry point: the Dashboard "Misi Harian" card (R1-MUR-2 item 5; its rows open `/misi-harian/:id`, its heading link opens `/misi-harian`). The sidebar item `misi-harian` (`src/shells/nav/user-nav.ts:218`) stays hidden (no matrix row), so the page is reached from the Dashboard only. A pupil sees only today's missions of own classes (GAME-20); the pupil API is `GET /api/missions/today` (API-GUR-11 family, card S6-T07). Global (platform) missions have no authoring screen in R1 (no matrix row, no V2 screen observed), so none exists to list; the "Global" clause of GAME-20 is inert until one is created in data. (2) **Soalan Aku Salah** is the Remedial/Ulang Kaji drill of row 12 (46 section 4.10): `/practice/revision` and `/practice/revision/:code` (`src/modules/m05-practice/routes/chapter.ts:57,71`) stay and open from the Remedial cards ("Latihan Pemulihan", "Ulang Latihan"); only the sidebar entry stays hidden. Neither route answers 404.

### 1.4 Reference rule
1. Behaviour, flow, timers, result layout, BM copy: V2 first, else V1.
2. Question display and answering: section 4.6 (schema documents and D41/D90/D97/D105), not V2 rendering.
3. V2 broken (404, dead link, wrong label or title, contradictory rule, unsafe control): fix minimally and log an FD. V2 works: replicate exactly.
4. Original UX (D77 and the standing rule): no menu, page, tab or section is added, removed or renamed beyond what this PRD lists. Visual theme (Nuxt UI, light and dark) follows D28-D32.
5. Decisions respected: D72/D96 (Darjah hidden; secondary only), **D101 (T1-T3 pupils get practice like V2: Latih Tubi, Soalan by Chapter, Topik, Peta Belajar serve T1-T5 wherever questions exist; the "Kandungan ... akan datang" gate is removed)**, D100 (every ticked module fully working), D102 (Alesa and Keluarga Angkat stay hidden), D73, D74, D79-D99, D89 (admin picks Bab), D90, D91, D94, D97, D98, D99, D104 (Subjektif and Kertas Subjektif fully working), D105 (drills serve figures and whole groups; supersedes the text-only part of D92), D106 (no dead links), D108(6) (hidden URL = standard 404).
6. Existing requirements (`v3-bijak-spm-scope.md`, `v2-admin-student-pipeline.md`, `v2-portals.md`, `v2-secondary-only.md`, `role-access-matrix.md`) are reconciled here. Where this PRD supersedes a line it says so (see FD table in 4.7).

---

## 2. Shared student shell for 1.0

### 2.1 Sidebar (desktop at least 1024 px, and the mobile drawer: one list, one order)

Order follows the V2 pupil sidebar (`pelajar/layout.blade.php`) reduced to the 1.0 set. Section labels follow the V3 shell (upper case, no emoji); the V2 strings are given for traceability. A section with no visible item is not rendered. No other entry may appear.

| Section label (V2 string) | Item (exact label) | Route | Badge | Source of position |
|---|---|---|---|---|
| (none) | Dashboard | `/dashboard` | none | V2 first item |
| (none) | Remedial | `/remedial/saya` | none | V2 top group (after Target SPM, Misi Harian, both hidden) |
| SPM ("SPM") | SPM | `/spm` | "SPM" | V2 |
| SPM | Bijak SPM | `/spm/bijak` | "BARU" | V2 "Simulasi Peperiksaan" (BARU); v2-bijak-spm AC-01.1 keeps the one name "Bijak SPM" |
| SPM | Headcount | `/headcount` | none | V2 |
| SPM | Prestasi | `/prestasi` | none | V2 |
| SPM | Analitik Adaptif | `/analitik/pelajar` | none | V2 |
| SPM | Analisa Item | `/analisa-item` | none | V2 |
| NOTA RINGKAS ("📝 Nota Ringkas") | Heatmap Topik Lemah | `/buku-nota/heatmap` | none | V2 |
| PEMBELAJARAN ("Pembelajaran") | Latih Tubi | `/practice` | none | V2 first Pembelajaran item (V2 flag is OFF there; shown in V3 per D80 Q-02) |
| PEMBELAJARAN | Soalan by Chapter | `/practice/chapter` | none | V2 |
| PEMBELAJARAN | Kelas Saya | `/kelas-saya` | none | V2 |
| PEMBELAJARAN | Video | `/video` | none | V2 |
| PEMBELAJARAN | Permainan | `/permainan` | none | V2 |
| KILLER FEATURES ("💎 Killer Features") | Laporan Soalan | `/laporan-soalan` | none | V2 (OQ-MUR-4) |
| AKAUN & BANTUAN ("Akaun & Bantuan") | Profil Saya | `/profile` | none | V2 |
| AKAUN & BANTUAN | Tetapan Peribadi | `/tetapan` | none | V2 places it under "Visi & Pertandingan"; moved beside Profil Saya (V3 prototype-scope rule) |
| AKAUN & BANTUAN | Panduan | `/panduan` | none | V2 "Panduan Pengguna", matrix label "Panduan" |

Notes: V2 "Dashboard" heading is also used wrongly as the page title on Headcount (V2 bug, FD-MUR-1). Log Keluar is an action, not a sidebar row (A5). Active item is highlighted; "Latih Tubi" is not active on `/practice/chapter` (V3 rule `activeExcept`).

### 2.2 Header (V3 shell, kept)
Left: sidebar toggle and breadcrumb "{Section} / {Page title}". Right: search "Cari menu" (CTRL K, lists only the 1.0 items), streak pill "{n} hari", coin pill "{n} Koin" (mata is shown on Dashboard and Prestasi), light/dark toggle, avatar button. No notification bell (Notifikasi is out of 1.0). The page title and subtitle come from the module (the V2 subtitles are quoted in each module).

### 2.3 Account menu (avatar, or user card at the foot of the sidebar)
Shows the name and school. Entries, in order: Profil Saya, Tetapan Peribadi, Panduan, light/dark theme, Log Keluar. "Tiket Bantuan" (A4) is hidden. "Tukar Rakan Belajar" (V3-only mascot chooser) is covered by OQ-MUR-3.

### 2.4 Responsive behaviour (mandatory, all modules)
| Width | Required behaviour |
|---|---|
| 375 px | Sidebar is a drawer opened from the header and the bottom-nav "Lagi"; bottom nav shows only 1.0 destinations (Home = Dashboard, SPM, Game = Permainan, Lagi); one column; tables and chips scroll or wrap inside their container; touch targets at least 44 px; no horizontal page scroll at 320 px. |
| 768 px | Two-column grids where V2 uses `sm:`/`md:` grids; drawer still used below 1024 px. |
| 1280 px | Fixed sidebar (256 px) and content column; side panels (Dashboard "Artikel Untuk Kamu", stimulus panel) shown. |
All screens, dialogs and the quiz/attempt screens pass these three widths (project rule). Charts resize and keep labels readable. Cross-cutting rules: `docs/prd/r1/40-cross-cutting.md` section X6.1 (FR-X6-1 to FR-X6-11, AC-X6-1, AC-X6-2) apply to every module; section 4.8 below is the detailed contract for question-paper screens and 4.9 lists the behaviour per module.

### 2.5 Functional requirements of the shell
- FR-MUR-SH-1 The sidebar and drawer render the table in 2.1 (the 1.0 columns) plus the items of the modules marked "1.0 (linked from R1-MUR-x)" in the order of 2.1b; when the rest of the matrix ships, the full order of 2.1b. No other item appears.
- FR-MUR-SH-2 Every item opens a working screen (no 403, no redirect to Dashboard, no "akan datang" for any T1-T5 pupil whose data exists).
- FR-MUR-SH-3 The same list is used for sidebar and drawer (and "Cari menu" where V3 already has it: `PembelajaranLayout`; not added to `UserShell`, D115).
- FR-MUR-SH-4 Header pills show the pupil's own wallet values from the server (coin, streak), never constants.
- FR-MUR-SH-5 Light and dark themes both pass contrast checks on every Murid screen (D28-D32).
- FR-MUR-SH-6 Log Keluar ends the session and returns to `/login`.
- FR-MUR-SH-7 A pupil who types a URL of another role (guru, admin, `/prestasi/sekolah`, `/analisa-item/kelas`) gets the 403 page, never data. One rule (D115, 40 X10.3.2, 60): a wrong-role URL of a module that is switched on answers the existing 403 page (`ForbiddenPage`, ERR-ACC-01); a module that is hidden or switched off answers 404 for everyone.
- FR-MUR-SH-8 Darjah (D1-D6) never appears in any picker, chip, count or copy of the Murid portal (D72/D96).
- FR-MUR-SH-9 The prototype scope list (`src/app/prototype-scope.ts` STUDENT_ITEMS and the page "Belum Tersedia dalam Prototaip", lines 8-9, 52-59, `PrototypeUnavailablePage.vue:3`) is retired for Murid: every matrix row ticked in the Murid column opens its real screen. Only row 15 and row 37 (D102) and V2 extras with no matrix row stay hidden, through one switch, and their typed URL shows the standard 404.
- AC-MUR-SH-1 Given a T5 pupil on UAT, when the app opens at 375, 768 and 1280 px, then the menu lists exactly the 18 items of 2.1 (Log Keluar in the account menu) in that order.
- AC-MUR-SH-2 Given a pupil, when each sidebar item is opened, then the page loads with its own title and no console or API error.
- AC-MUR-SH-3 Given a pupil opens `/mohon-keluarga-angkat` or `/cikgu` (D102), then the standard 404 shows and nothing is revealed; given `/marketplace` or `/leaderboard` (rest of the matrix), then the real page opens.
- AC-MUR-SH-4 Given a 320x568 viewport, when each screen of this PRD is loaded on UAT data, then `scrollWidth <= innerWidth` on every screen.
- FR-MUR-SH-10 Body text is at least 14 px on phone (FR-X6-2); captions, badges and chart labels are at least 12 px; no text is truncated without a way to read it in full.
- FR-MUR-SH-11 The header coin pill "{n} Koin" links to Syiling & Token (R1-MUR-28) and the streak pill to Profil Saya "Kalendar Kombo"; both links work.
- FR-MUR-SH-12 When a tournament is active, a banner links to Tournament (R1-MUR-23); with none, no banner is rendered.
- AC-MUR-SH-5 Given a 375x667 viewport, when the Dashboard, a quiz screen and Prestasi load, then the computed font size of body paragraphs is at least 14 px and of badges at least 12 px.
- AC-MUR-SH-6 Given an active tournament in the data, when any shell page loads, then the banner is rendered and its link opens `/tournament`; given none, then no banner element exists.
- AC-MUR-SH-7 (FR-MUR-SH-7; status code per 40 FR-X2-4) Given a signed-in pupil, when the pupil opens `/guru/command-center`, `/admin-sekolah/command-center`, `/admin/studio` and `/prestasi/sekolah`, then each shows the "Akses Ditolak" page with status 403 and no data; and when the pupil calls `GET /api/admin/pksk-access`, then the API answers 403 `FORBIDDEN`.

---

### 2.1b Full sidebar (merged order, V2 sequence)

Items of the rest of the matrix are inserted in the V2 groups below; the 1.0 column items keep their place. Items marked (P1) are in 2.1; the other items appear with 1.0 when marked "1.0 (linked from R1-MUR-x)" in 1.3, otherwise with the rest of the matrix.

| Section | Items in order |
|---|---|
| (none) | Dashboard (P1), Remedial (P1) |
| SPM | SPM (P1), Bijak SPM (P1), Headcount (P1), Prestasi (P1), Analitik Adaptif (P1), Analisa Item (P1) |
| NOTA RINGKAS | Heatmap Topik Lemah (P1) |
| KILLER FEATURES | Laporan Soalan (P1) |
| STREAK & SYILING ("🔥 Streak & Syiling") | Syiling & Token (badge 🏆), Tukar Token, Cabaran Harian, Kedai Hadiah (badge "DIGITAL"), Kedai Hadiah DIGITAL (row 38, route `/cikgu/hadiah`, badge "DIGITAL"), Pencapaian, Kotak Misteri, Rujuk Kawan, Marketplace, Papan Pendahulu, Kedudukan, Cabutan Bertuah |
| PEMBELAJARAN | Latih Tubi (P1), Soalan by Chapter (P1), Soalan Berstruktur, PKSK (badge "PRO"), Topik, Peta Belajar, Kelas Saya (P1), Set Soalan Guru, Artikel, Video (P1), Audio KBAT, Permainan (P1), Tournament |
| AKAUN & BANTUAN | Profil Saya (P1), Timeline Saya, Jemput Ibu Bapa, Tetapan Peribadi (P1), Panduan (P1), Tiket Bantuan |

Notes: V2 has no sidebar item for Tournament or Kedai Hadiah DIGITAL; they are placed by function (competitions near Permainan, digital shop next to Kedai Hadiah). Kedudukan is in V2's "Streak & Syiling" group (not Pembelajaran as in V3 today). "Notifikasi" (bell) stays hidden: it has no matrix row.

---

## 3. Modules, the 1.0 columns (matrix order)

Template per module: ID line, **Action**, **Screen specification (from V2)** (route, title, regions, every label, button and state, described in words), name, route, matrix row, priority, current status, outcome, reference behaviour, FRs, data and dependencies, ACs, current gap and root cause (change list), fidelity deviations, decisions applied. Only the listed gaps are changed; the existing screen, routes and API are reused (FR-X1-5). The V2 screens show V2's structure: for question structure and DSKP this PRD follows FR-X1-4, D90, D41 and D105, and each difference is marked "V2 differs".

### R1-MUR-A1 Profil Saya
- **Action**: Complete
- **Screen specification (from V2)** (route `/profile`, browser title "Profil Saya — PRESTASIPLUS"; public page `/pelajar/:id`, title "{pupil name} — Profil Awam — PRESTASIPLUS"). Regions, top to bottom:
  1. Hero: initials avatar (two letters), pupil name, school name in capitals as stored, "Ahli sejak {date}". V2 prints the month in English ("23 October 2026"): mixed-language defect; V3 prints the month in BM.
  2. Card "Profil Awam Saya" / "Kongsi profil anda dengan kawan-kawan!": the public URL as text, button "Salin" (copies the URL), an open-in-new-tab icon button (opens the public page).
  3. Six stat tiles, label under value: "Koin Saya", "Streak Hari", "Level", "Hari Berlatih", "Sesi Latihan", "Ketepatan" (value ends with %). Zero-data pupil observed: Koin 0, Streak 1, Level 1, Hari Berlatih 1, Sesi 2, Ketepatan 0%.
  4. Form card "Kemaskini Profil" / "Ceritakan tentang diri dan cita-cita anda": fields "Bio Saya" and "Cita-Cita Saya", button "Simpan". Placeholders and limits are not in the capture: follow FR-MUR-A1-3 and the reference behaviour below.
  5. Three tiles: "Kombo Hari Ini", "Rekod Terpanjang", "Hari Berlatih" (observed 1, 1, 1).
  6. Card "Koleksi Lencana", counter "{n} lencana telah dikumpul". Empty state (observed): "Belum ada lencana lagi" / "Teruskan berlatih untuk dapatkan lencana pertama anda!" and button "Mula Latih Tubi" (destination not captured: opens Latih Tubi, `/practice`). Populated badge grid: Not observed in V2 — follow FR-MUR-A1-1 and R1-MUR-34.
  7. Card "Kalendar Kombo (30 Hari Terakhir)" / "Jejak latihan harian anda": 30 day cells, each showing the two-digit day of month, oldest first, ending today; note under the grid "Petak lebih gelap bermaksud lebih banyak sesi pada hari itu.". Shades and cell titles as in the reference behaviour.
  8. Card "Sesi Terkini" / "{n} latihan terakhir anda" (observed "2 latihan terakhir anda"): table with columns "Mod", "Soalan", "Betul", "Ketepatan" (percentage pill), "Koin" (coin icon and number), "Tarikh". Observed rows: mode "Spm Tahun Lepas" (raw snake-case turned to title case: defect, FR-MUR-A1-6 requires proper BM mode names), 40 and 80 questions, 0 correct, 0%, 0 coins, date as English relative text "1 week ago" (defect: V3 prints a BM date). Empty-state copy is in the reference behaviour; the empty state itself was not captured.
  - Public page `/pelajar/:id` (no sidebar; brand "PRESTASIPLUS" at the top): initials avatar, pupil first name only (no school name, privacy of minors, OQ-API-04), "Ahli sejak {date}"; four tiles "Koin", "Streak Hari", "Level", "Hari Berlatih"; the line "Sesi latihan: {n} · Ketepatan purata: {x}%"; button "Sertai PRESTASIPLUS" (destination not captured: opens registration). Bio and cita-cita are not shown in V2 and are not shown in V3 either (free text written by a minor, FR-MUR-A1-5).
  - Loading and error states: Not observed in V2 — follow FR-X6 (40-cross-cutting).
- **Current gap and root cause (change list; reuse the existing page)**: (1) `src/modules/m01-authentication/pages/ProfilePage.vue` shows only name, e-mail, "ahli sejak" and a "Kemaskini Profil" button: add the blocks of FR-MUR-A1-1 in the order shown; (2) add API reads for last-30-day calendar, badges and last 10 sessions (none exist, parity C20); (3) replace the "Kemaskini Profil" button by the in-page form; (4) public profile `/pelajar/:id` page exists: align fields to FR-MUR-A1-5.
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Bio Saya | textarea, 4 rows, placeholder "Tulis sedikit tentang diri anda...", counter "{n}/1000" | Tidak | stored bio or empty | - | trimmed; max 1000 (`Bio tidak boleh melebihi 1000 aksara.`); blank clears; never shown on the public page | - | `users.bio` (holds 1000) | API-AUTH-09 |
  | Cita-Cita Saya | text, placeholder "cth: Doktor, Jurutera, Saintis Data..." | Tidak | stored or empty | - | trimmed; max 255 (`Cita-cita tidak boleh melebihi 255 aksara.`); blank clears; never on the public page | - | `users.aspiration` varchar(255) null (new, A2) | API-AUTH-08/09 (new key `aspiration`) |
  | Simpan | button | - | - | label "Menyimpan..." while sending, disabled | success line `Profil berjaya dikemaskini.` (green, under the form, 4 s); failure keeps the typed text and shows the server text; offline: ERR-NET-01 | Bio, Cita-Cita | - | `PUT /api/me` body `{bio, aspiration}` only (partial: an absent key keeps the stored value; `name` is optional) |
  | Salin | button | - | - | copies the public URL; label "Disalin!" for 2 s | clipboard blocked: the URL text is selected and the line `Salin pautan secara manual.` shows | - | - | - |
  | Tukar Gambar (only where the picture upload already exists, FR-MUR-A1-8) | file | Tidak | none | JPG, PNG, WEBP, up to 2 MB | `Fail mesti gambar JPG, PNG atau WEBP.` / `Saiz gambar tidak boleh melebihi 2 MB.`; success `Gambar profil berjaya dikemaskini.` | - | picture file | API-AUTH-11 |
  | Mula Latih Tubi (empty badges) | link | - | - | opens `/practice` | - | - | - | - |
  - Behaviour: ERR-REQ-01 for field errors; ERR-NET-01/02 and ERR-SYS-01 for failures (typed text kept). "Sesi Terkini": last 10 sessions of all modes, newest first, no pager; mode names in BM from OPT-MODE-SESI (section A1). Calendar and tiles use Malaysia days. Level = floor(XP / 1000) + 1; streak: first activity 1, same day unchanged, next day +1, a gap resets to 1. "Ketepatan" per 0A.4.
  - Grade and school are not editable here (FR-MUR-A2-6): the form has no Tingkatan or school control.
  - New requirements: FR-MUR-A1-9 `PUT /api/me` is partial: every key is optional, an absent key keeps the stored value, `name` when present is 1 to 255 characters; the form sends `{bio, aspiration}` only. FR-MUR-A1-10 `aspiration` is stored (new column) and returned by `GET /api/me`; it is never in the public profile. FR-MUR-A1-11 The Bio limit is 1000 on every screen (the legacy profile edit page that shows 500 and "Baki: 500 aksara" is corrected to `{n}/1000`).
  - New acceptance criteria: AC-MUR-A1-8 Given a Bio of 1001 characters, when "Simpan" is pressed, then `Bio tidak boleh melebihi 1000 aksara.` shows, nothing is saved and the typed text stays. AC-MUR-A1-9 Given `PUT /api/me` with `{aspiration: "Doktor"}` only, then the stored name and bio are unchanged and `GET /api/me` returns `aspiration` "Doktor". AC-MUR-A1-10 Given a blank Cita-Cita saved, then the stored value is null and the field is empty after reload.
- **Name**: "Profil Saya" (title "Profil Saya", subtitle "Maklumat dan pencapaian anda")
- **Route**: `/profile`; public view `/pelajar/:id`
- **Matrix row**: A1. **Priority**: P1.
- **Current status**: V3-GitHub and V3-UAT: name, e-mail, "ahli sejak" and a "Kemaskini Profil" button only. Partial.
- **Outcome**: the pupil sees own identity, progress and badges and can share a public profile.
- **Reference behaviour (V2 `pelajar/profil.blade.php`)**, top to bottom:
  1. Hero: initials avatar, name, e-mail, school name, "Ahli sejak {j F Y}".
  2. Card "Profil Awam Saya" / "Kongsi profil anda dengan kawan-kawan!" with the public URL, button "Salin" (becomes "Disalin!" for 2 s) and an open-in-new-tab icon.
  3. Six tiles: "Koin Saya", "Streak Hari", "Level", "Hari Berlatih", "Sesi Latihan", "Ketepatan" (%).
  4. Form card "Kemaskini Profil" / "Ceritakan tentang diri dan cita-cita anda": "Bio Saya" (textarea, max 1000, placeholder "Tulis sedikit tentang diri anda..."), "Cita-Cita Saya" (text, max 255, placeholder "cth: Doktor, Jurutera, Saintis Data..."), button "Simpan".
  5. Three tiles: "Kombo Hari Ini", "Rekod Terpanjang", "Hari Berlatih".
  6. "Koleksi Lencana" / "{n} lencana telah dikumpul"; locked badges stay visible greyed; empty: "Belum ada lencana lagi" / "Teruskan berlatih untuk dapatkan lencana pertama anda!" and button "Mula Latih Tubi".
  7. "Kalendar Kombo (30 Hari Terakhir)" / "Jejak latihan harian anda": 30 day cells; shades 0 sessions #f1f5f9, 1 #bbf7d0, 2-3 #4ade80, 4+ #15803d; cell title "{j M Y} — Tidak berlatih" or "{n} sesi"; note "Petak lebih gelap bermaksud lebih banyak sesi pada hari itu.".
  8. "Sesi Terkini" / "{n} latihan terakhir anda": columns Mod, Soalan, Betul, Ketepatan (green at least 70, amber 50-69, red below 50), Koin, Tarikh; empty "Belum ada sesi latihan lagi" / "Teruskan berlatih untuk melihat rekod anda di sini!".
  Level formula: wallet level = floor(XP / 1000) + 1 (V2 `PracticeRecorder`). V2 Dashboard uses XP/100, a contradiction (FD-MUR-5, OQ-MUR-8).
- **Functional requirements**
  - FR-MUR-A1-1 The page shows the eight blocks above in that order with the exact BM labels.
  - FR-MUR-A1-2 All figures are the pupil's own, from server data; no other pupil's id is accepted.
  - FR-MUR-A1-3 "Simpan" saves Bio and Cita-Cita (limits 1000 and 255) and shows a success line; a failure keeps the typed text and shows the error.
  - FR-MUR-A1-4 "Salin" copies the public URL to the clipboard; fallback text selection when clipboard is blocked.
  - FR-MUR-A1-5 The public profile `/pelajar/:id` shows only the brand, the pupil's **display name = first name** (section 4.3; never the full name, never the school, not even to a pupil of the same school), "Ahli sejak {date}", the four tiles "Koin", "Streak Hari", "Level", "Hari Berlatih", the line "Sesi latihan: {n} · Ketepatan purata: {x}%" and the button "Sertai PRESTASIPLUS" (V2 public profile page `/pelajar/:id`); no bio, cita-cita, e-mail, phone, class list or posts (privacy; minors). Decided by principle 2026-11-04 (OQ-API-04): V2 showed the full name and school, which V3 does not copy because the page is anonymous and the owners are children; this matches the API (`PerformancePublicProfile`: first name, `school: null`). Deviation FD-MUR-6.
  - FR-MUR-A1-6 "Sesi Terkini" lists the last 10 sessions of all modes, mode names in BM (not raw snake case).
  - FR-MUR-A1-7 The V3 "Kemaskini Profil" button is replaced by the in-page form (no extra page, no menu change).
  - FR-MUR-A1-8 Profile picture upload (V3 `POST me/picture`) is kept only if already built; no new field is added.
- **Data and dependencies**: wallet (M14: syiling, XP, streak, level), practice sessions (owner M05), badges (M14), `GET/PUT /api/me`, `POST me/picture` (exists), public profile endpoint (needed), calendar and last-session reads (needed). Admin feed: none (R1-ADM gamification screens are out of 1.0).
- **Acceptance criteria**
  - AC-MUR-A1-1 Given a pupil with 2 sessions, when `/profile` opens, then tiles, calendar and "Sesi Terkini" show those sessions only.
  - AC-MUR-A1-2 Given the pupil types a Bio and Cita-Cita and presses "Simpan", when the page reloads, then both values persist.
  - AC-MUR-A1-3 Given "Salin" is pressed, then the label reads "Disalin!" and the clipboard holds the public URL.
  - AC-MUR-A1-4 Given a pupil with no badges, then the empty text "Belum ada lencana lagi" and the button "Mula Latih Tubi" show.
  - AC-MUR-A1-5 Given the public profile of a pupil, when an anonymous visitor or another pupil opens it, then only the first name is shown (no surname, no school, no bio or cita-cita) and no e-mail or phone is present in the HTML or API response.
  - AC-MUR-A1-6 Given 375 px, then the six tiles are two columns, the sessions table scrolls inside its card, and the page does not scroll sideways.
  - AC-MUR-A1-7 Given a pupil of school X opens the public profile of a pupil of school Y (or of school X), then the page shows the first name only, no school name and no surname, in the HTML and in the API response.
- **Current gap and root cause**: thin `/profile` page (m09/m01 profile page); no endpoints for calendar, badges, sessions (parity C20).
- **Fidelity deviations**: FD-MUR-5 (level formula), FD-MUR-6 (public profile minimal fields, privacy).
- **Decisions applied**: OQ-MUR-8 (level formula). (decided in section 6.1).

### R1-MUR-A2 Tetapan Peribadi
- **Action**: Complete
- **Screen specification (from V2)** (route `/tetapan`, browser title "Tetapan — PRESTASIPLUS"). Regions, top to bottom:
  1. Hero: gear icon, initials avatar, small label "⚙️ Profil", title "Tetapan Peribadi", subtitle "Maklumat akaun anda dalam mod baca sahaja.".
  2. Account card header: initials avatar, pupil name, role line "Pelajar".
  3. Five read-only rows, label left and value right: "📧 E-mel" (the account e-mail), "📱 Telefon" ("—" when empty), "🏫 Sekolah" (school name in capitals), "👤 Peranan" ("Pelajar"), "✅ Status" ("● Aktif" in a green pill).
  4. Notice under the card: "🔒 Untuk mengedit maklumat profil, sila log masuk dengan akaun anda. Halaman ini hanya menunjukkan data dalam mod demo." (demo leftover, replaced per FR-MUR-A2-5).
  - Buttons: none; the page is read-only in V2. Password form and "Mod Rohani" are V3 additions below the card (FR-MUR-A2-3, FR-MUR-A2-4).
  - States: empty telefon shows "—". Status "● Tidak aktif" is from the V2 view code, not captured. Loading and error: Not observed in V2 — follow FR-X6.
- **Current gap and root cause (change list)**: (1) `src/modules/m01-authentication/pages/TetapanPage.vue` shows only "Mod Rohani": add the read-only account card (five rows) above it; (2) keep "Mod Rohani" and the password form unchanged; (3) replace the demo-mode note (FD-MUR-7).
- **Field & behaviour spec** (screen `/tetapan`; the account card is read only, the password form and "Mod Rohani" are the only inputs)
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | E-mel, Telefon, Sekolah, Peranan, Status | read-only rows | - | "—" when empty | Status "● Aktif" or "● Tidak aktif"; Peranan "Pelajar" | - | - | - | `GET /api/me` |
  | Kata Laluan Semasa | password | Ya | empty | - | blank: `Sila isi kata laluan semasa.`; wrong (422 on `currentPassword`): `Kata laluan semasa tidak betul.`; never trimmed | - | - | `POST /api/me/password` |
  | Kata Laluan Baharu | password, hint "Minimum 8 aksara" | Ya | empty | - | min 8, max 200: `Kata laluan mestilah sekurang-kurangnya 8 aksara.`; equal to the current one: `Kata laluan baharu mesti berbeza daripada kata laluan semasa.` | - | password hash | same |
  | Sahkan Kata Laluan Baharu | password | Ya | empty | must equal the new password | `Pengesahan kata laluan tidak sepadan.` (shown under Kata Laluan Baharu) | - | - | same |
  | Tukar Kata Laluan | button | - | - | label "Menyimpan..." while sending | success line `Kata laluan berjaya dikemaskini.`; the session cookie and CSRF token rotate and the pupil's other sessions end; failures per ERR-REQ-01, ERR-RATE-01 | all three fields | - | same |
  | Aktifkan Mod Rohani | toggle; hint `Suis utama. Jika dimatikan, semua ciri rohani dimatikan.` | Tidak | off | - | - | - | `spiritualMode` | `me/settings` |
  | Tunjuk doa sebelum quiz | toggle | Tidak | off | - | - | Mod Rohani on | `showBismillahSplash` | same |
  | Push waktu Subuh + masa | toggle + time `HH:mm` | Tidak | off, 05:30 | - | pattern `^([01]\d|2[0-3]):[0-5]\d$`: `Masa mesti dalam format JJ:MM.`; blank = default | Mod Rohani on | `subuhPushEnabled`, `subuhPushTime` | same |
  | Mod Ramadan + masa | toggle + time | Tidak | off, 04:30 | - | as above | Mod Rohani on | `ramadanModeEnabled`, `sahurPushTime` | same |
  | Agama (pilihan) | select | Tidak | "— Tidak nyatakan —" (null) | OPT-FAITH | `Pilihan tidak sah.` | Mod Rohani on | `faith` | same |
  | Simpan Tetapan | button | - | - | "Menyimpan..." | success `Tetapan berjaya disimpan.`; every save writes all fields, an unticked box is false | - | - | same |
  - Behaviour: a Google/DELIMa card is not rendered in R1 (there is no Google login; K22 closed). Password minimum 8 applies where a password is SET (register, reset, change); login only needs a non-empty password so older accounts still sign in (K1, D-A17). The three password labels are exactly the three above. Errors cite ERR-REQ-01 (field text under the field), ERR-NET-01/02, ERR-SYS-01, ERR-AUTH-01.
  - New requirements: FR-MUR-A2-7 The account contract returns BM texts only (no Laravel English such as "The password is incorrect.") for current-password-wrong, validation and taken e-mail (K7). FR-MUR-A2-8 `ACCOUNT_PASSWORD_MIN` is 8 on register, reset and change, and the register hint reads "Minimum 8 aksara" (K1). FR-MUR-A2-9 The "Mod Rohani" block lists exactly the five controls above with the BM hint; the mixed-language hint of the earlier build is replaced.
  - New acceptance criteria: AC-MUR-A2-7 Given a new password equal to the current one, then `Kata laluan baharu mesti berbeza daripada kata laluan semasa.` shows and nothing changes. AC-MUR-A2-8 Given a wrong current password, then the field text `Kata laluan semasa tidak betul.` shows (not English) and the typed values stay. AC-MUR-A2-9 Given Mod Rohani off, then the four dependent controls are disabled and saving keeps their stored values.
- **Name**: "Tetapan Peribadi" (title "Tetapan Akaun", subtitle "Maklumat profil anda"; hero "Tetapan Peribadi" / "Maklumat akaun anda dalam mod baca sahaja.")
- **Route**: `/tetapan`. **Matrix row**: A2. **Priority**: P1.
- **Current status**: V3 both: only "Mod Rohani" (prayer-time toggles); account info not visible.
- **Outcome**: the pupil checks account facts and personal preferences.
- **Reference behaviour (V2 `pelajar/tetapan.blade.php`)**: hero with initials; account card with name and role; rows "📧 E-mel", "📱 Telefon" (or "—"), "🏫 Sekolah" (or "—"), "👤 Peranan", "✅ Status" ("● Aktif" / "● Tidak aktif"); a warning note "🔒 Untuk mengedit maklumat profil, sila log masuk dengan akaun anda. Halaman ini hanya menunjukkan data dalam mod demo." (this note is a demo leftover and wrong in a live system, FD-MUR-7). Optional Google/DELIMa card "Akaun Google (DELIMa)" with "Sambungkan"/"Putuskan" only where Google login exists.
  V3 additions that stay (already built, user-visible, not in V2): "Mod Rohani" preferences and password change (`me/password`). They are placed below the account card, not instead of it.
- **Functional requirements**
  - FR-MUR-A2-1 The page shows the five read-only rows with the exact labels above.
  - FR-MUR-A2-2 Role shows "Pelajar"; status shows the real account state.
  - FR-MUR-A2-3 A "Tukar Kata Laluan" form (current, new, confirm) calls `me/password` and shows success or error in BM; the new password has at least 8 characters (the V2 hint "minimum 8 aksara"; the same rule as admin and school-admin password reset, D-A17); no other profile field is editable here (editing is in A1).
  - FR-MUR-A2-4 "Mod Rohani" keeps its existing toggles unchanged.
  - FR-MUR-A2-5 The demo-mode note is replaced by "Untuk menukar e-mel, telefon atau sekolah, hubungi guru atau pentadbir sekolah anda." (OQ-MUR-9).
  - FR-MUR-A2-6 A pupil cannot change Tingkatan (`grade`), school (`schoolId`) or role through `PUT /api/me` or any other pupil call: those fields change only through the admin user edit or the school-admin pupil edit. The server ignores or rejects them; the stored values never change from a pupil request (scope of XS-1, rankings, level gating and the school admin's list depends on them).
- **Data and dependencies**: `GET /api/me`, `me/settings`, `me/password` (exist). Owner M01.
- **Acceptance criteria**
  - AC-MUR-A2-1 Given a pupil, when `/tetapan` opens, then e-mail, telefon, sekolah, peranan and status show the pupil's own values.
  - AC-MUR-A2-2 Given a wrong current password, when "Tukar Kata Laluan" is submitted, then an error shows and the password is unchanged.
  - AC-MUR-A2-3 Given a valid change, then the pupil can log in with the new password and not the old.
  - AC-MUR-A2-4 Given 375 px, then rows stack label over value and nothing overflows.
  - AC-MUR-A2-5 Given a T5 pupil of school X sends `PUT /api/me` with `grade` 8, `schoolId` of school Y and `role` "teacher", then the response does not apply them (ignored, or 422 for those fields) and `GET /api/me` still returns Tingkatan 5, school X and role pupil; the same pupil appears unchanged in the school-X pupil list.
  - AC-MUR-A2-6 Given a new password of 7 characters, then "Tukar Kata Laluan" refuses it with a BM message and the password is unchanged; with 8 characters it is accepted.
- **Current gap and root cause**: page built to V3 spec (Mod Rohani only), account block omitted.
- **Fidelity deviations**: FD-MUR-7 (demo note), V3 password form kept.
- **Decisions applied**: OQ-MUR-9. (decided in section 6.1)

### R1-MUR-A3 Panduan
- **Action**: Fix
- **Screen specification (from V2)** (route `/panduan`, browser title "Panduan Pengguna — PRESTASIPLUS"; public page, no login needed). Regions, top to bottom:
  1. Top bar: links "Laman Utama" (public home) and "Dashboard" (pupil dashboard).
  2. Hero: 📖, title "Panduan Pengguna PRESTASIPLUS", subtitle "Pilih peranan anda untuk mula. Semua maklumat di hujung jari!".
  3. Role chooser, five selectable cards (icon, role, sub-title): "Pelajar" / "Darjah 1 – Tingkatan 5" (V3: "Tingkatan 1 – Tingkatan 5", FD-MUR-8), "Guru" / "Guru Mata Pelajaran", "Ibu Bapa" / "Pemantauan Anak", "Admin Sekolah" / "Pengetua / GPK", "PPD / JPN" / "Pegawai Daerah / Negeri". Selecting a card shows that role's panel only.
  4. Pupil panel, three blocks.
     - "Cara Daftar Akaun Pelajar", numbered steps (title, then text): 1 "Buka Laman Web" (V2 text names the old site address; V3 uses the new address), 2 "Klik \"Daftar\"" "Di halaman utama, klik butang \"Daftar Percuma\" atau minta guru daftarkan anda.", 3 "Isi Maklumat" "Masukkan nama penuh, e-mel, kata laluan, dan pilih tingkatan/darjah anda." (V3: "tingkatan"), 4 "Masuk Kelas" "Minta guru anda menambah nama anda ke dalam kelas." (V2 text: "Minta kod kelas daripada guru anda dan masukkan untuk sertai kelas." contradicts V2's own Kelas Saya page, which has no code box and says the teacher adds the pupil; the replacement is the same rule in the wording of that page, FD-MUR-37, copy decided by D113), last step marked ✓ "Siap! Mula Berlatih" "Anda kini boleh mula latih tubi, kumpul kombo, dan naik ranking!".
     - "Apa Yang Boleh Anda Buat", six items: "📝 Latih Tubi" "Jawab soalan mengikut subjek dan topik. Semakin banyak latihan, semakin pandai!"; "🔥 Kombo Harian" "Latih tubi setiap hari untuk kekalkan kombo anda. Jangan putus!"; "⚔️ Battle" "Cabaran masa nyata — lawan kawan atau pelajar lain secara langsung!" (hidden feature: dropped in V3, FR-MUR-A3-2); "📊 Prestasi 360" "Lihat kemajuan anda: ketepatan, subjek kuat/lemah, dan cadangan latihan."; "🏆 Ranking & Lencana" "Naik ranking sekolah dan kumpul lencana pencapaian!"; "🪙 Koin & Ganjaran" "Setiap latihan beri koin. Kumpul dan tukar dengan ganjaran menarik.".
     - "Soalan Lazim Pelajar": five accordion rows (question toggles the answer). "Macam mana nak reset kata laluan?" - "Pergi ke halaman login, klik \"Lupa Kata Laluan\", masukkan e-mel anda, dan ikut arahan dalam e-mel yang dihantar."; "Saya tak ada e-mel. Boleh daftar?" - "Ya! Minta guru anda daftarkan akaun untuk anda melalui panel guru. Guru boleh import senarai pelajar."; "Apa itu Kombo?" - "Kombo bermaksud hari berturut-turut anda berlatih. Jika anda berlatih setiap hari tanpa putus, kombo akan bertambah. Putus sehari = mula dari 0!"; "Boleh tukar kelas?" - "Minta guru baru anda tambahkan anda ke kelas baharu. Anda boleh berada dalam lebih dari satu kelas."; "Macam mana nak naikkan ketepatan?" - "Fokus pada topik yang lemah (lihat di Prestasi 360), ulang latihan topik tersebut. Kualiti lebih penting dari kuantiti!".
  5. Other role panels (same three-block pattern: "Cara Daftar Akaun Guru", "Alat-Alat Guru", "Soalan Lazim Guru"; "Cara Daftar Akaun Ibu Bapa", "Apa Yang Ibu Bapa Boleh Lihat", "Soalan Lazim Ibu Bapa"; "Cara Mula Sebagai Admin Sekolah", "Fungsi Admin Sekolah", "Soalan Lazim Admin"; "Cara Mula Sebagai PPD / JPN", "Fungsi PPD / JPN", "Soalan Lazim PPD / JPN"). Their body copy belongs to the other portals' PRDs; a pupil sees them only after choosing the role card.
  6. Help block: 💬 "Perlukan Bantuan Lanjut?" / "Hubungi pasukan sokongan kami untuk sebarang pertanyaan." with two buttons "E-mel Kami" (mail link) and "Tiket Bantuan" (ticket page; replaced per FR-MUR-A3-4).
  7. Footer: "© 2026 PRESTASIPLUS 🇲🇾" / "Platform Latih Tubi Nasional".
  - Loading and error: Not observed in V2 — follow FR-MUR-A3-3.
- **Copy notes (earlier review of the same screen)**: Exact copy (closes E-4): heading "Panduan Pengguna PRESTASIPLUS", "Pilih peranan anda untuk mula. Semua maklumat di hujung jari!"; role cards Pelajar ("Darjah 1 – Tingkatan 5"), Guru ("Guru Mata Pelajaran"), Ibu Bapa ("Pemantauan Anak"), Admin Sekolah ("Pengetua / GPK"), PPD / JPN ("Pegawai Daerah / Negeri"); section "Cara Daftar Akaun Pelajar" with 5 steps ("Buka Laman Web", "Klik \"Daftar\"", "Isi Maklumat", "Masuk Kelas", "Siap! Mula Berlatih"); "Apa Yang Boleh Anda Buat" with 6 items (Latih Tubi, Kombo Harian, Battle, Prestasi 360, Ranking & Lencana, Koin & Ganjaran); "Soalan Lazim Pelajar" with 5 questions (reset kata laluan; tiada e-mel; apa itu Kombo; tukar kelas; naikkan ketepatan). V2 differs: the pupil card says "Darjah 1 – Tingkatan 5" and step 1 names "prestasiplus.my" — PRD uses "Tingkatan 1 – Tingkatan 5" (D72) and the new site address; the list "Apa Yang Boleh Anda Buat" is trimmed to features that exist.
- **Current gap and root cause (change list)**: (1) UAT `GET /api/config/support` returns 404 (`apps/api/src/modules/support/support.service.ts:113`): seed or create the support row; the page must still render without it; (2) `src/modules/m09-content/lib/panduan-content.ts`: keep the V2 sections and the "Tingkatan 1 – Tingkatan 5" wording; replace step 4 "Masuk Kelas" text (no class code, FD-MUR-37); replace the Tiket Bantuan block per FR-MUR-A3-4.
- **Field & behaviour spec** (public page; no form fields)
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Role cards: Pelajar, Guru, Ibu Bapa, Admin Sekolah, PPD / JPN | 5 selectable cards, `aria-pressed` | - | Pelajar | titles and sub-titles as in the screen specification | - | - | - | static `panduan-content.ts` |
  | Soalan Lazim Pelajar | 5 accordion rows | - | all closed | several rows may be open at the same time; each row toggles on its own | - | - | - | static |
  | E-mel Kami / support contact | link | - | hidden | `GET /api/config/support`; when the row is missing the block is not rendered and no error shows | - | support row | - | API-SUP-04 |
  - Behaviour: step 4 reads "Minta guru anda menambah nama anda ke dalam kelas." (FD-MUR-37, decided; this is the V2 rule of Kelas Saya). The "Tiket Bantuan" button is replaced by the support contact text (A4 stays hidden). Load failure of the support row is silent (ERR-SYS-01b is not shown on this page).
  - New requirements: FR-MUR-A3-5 The pupil panel never mentions Battle, AI or a class code, and uses "Tingkatan 1 – Tingkatan 5". FR-MUR-A3-6 The FAQ rows are independent toggles with `aria-expanded`.
  - New acceptance criteria: AC-MUR-A3-5 Given the pupil panel, when two FAQ rows are opened one after the other, then both stay open. AC-MUR-A3-6 Given `GET /api/config/support` returns 404, then the page shows no contact block and no error banner.
- **Name**: "Panduan" (page "Panduan Pengguna PRESTASIPLUS")
- **Route**: `/panduan`, also `/pusat-tuisyen/panduan`. **Matrix row**: A3. **Priority**: P2.
- **Current status**: V3 matches V2 (role chooser: Pelajar, Guru, Ibu Bapa, Admin, PPD; steps "Buka Laman Web", "Klik \"Daftar\"", "Isi Maklumat", "Masuk Kelas", "Siap! Mula Berlatih"; "Apa yang boleh anda buat"; Tiket Bantuan). UAT: `GET /api/config/support` returns 404 "Konfigurasi sokongan tidak dijumpai." because the support singleton row is missing.
- **Outcome**: self-service help.
- **Reference behaviour**: public page, role chooser, per-role steps and capability list. Pupil section sub-title V2 "Darjah 1 - Tingkatan 5"; V3 "Tingkatan 1 – Tingkatan 5" (D72).
- **Functional requirements**
  - FR-MUR-A3-1 The page loads for a logged-in pupil with the Pelajar section preselected.
  - FR-MUR-A3-2 The pupil section lists only features that exist in 1.0 (no Battle-only or AI claims that are hidden); wording "Tingkatan 1 – Tingkatan 5".
  - FR-MUR-A3-3 Contact details come from `GET /api/config/support`; when the row is missing the page still renders and hides the contact block (no error banner).
  - FR-MUR-A3-4 The Tiket Bantuan block is replaced by the support contact text (A4 hidden).
- **Data and dependencies**: static content (`panduan-content.ts`), support config (admin Tetapan; cross-ref the admin PRD settings row).
- **Acceptance criteria**
  - AC-MUR-A3-1 Given UAT with the support row missing, when `/panduan` opens, then no network error is shown to the pupil.
  - AC-MUR-A3-2 Given the pupil section, then it contains no mention of Darjah.
  - AC-MUR-A3-3 Given 375 px, then the role chooser wraps and steps stack.
  - AC-MUR-A3-4 Given the pupil section, then no text mentions a class code ("kod kelas") and step 4 reads "Minta guru anda menambah nama anda ke dalam kelas."
- **Current gap and root cause**: UAT config row missing (`support.service.ts:113`).
- **Fidelity deviations**: FD-MUR-8 (Tingkatan 1-5 wording, D72), FD-MUR-37 (no class code in step 4).
- **Decisions applied**: none needed.

### R1-MUR-A5 Log Keluar
- **Action**: Keep
- **Screen specification (from V2)**: no separate page or route. Log Keluar is a header icon and an entry on the sidebar user card, present on every pupil screen. Label and confirmation dialog: Not observed in V2 — follow FR-MUR-SH-6 (ends the session, returns to `/login`).
- **Current gap and root cause**: None. Verify the ACs only.
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Log Keluar | button in the account menu (one tap, no dialog) | - | - | - | an open Bijak sitting is not warned about: its answers are already saved on the server (B-057) | - | clears the token and every key starting `pp.bijak.local.` (V3 key `autosave.ts:26`) and `pp:draft:*` | `POST /api/auth/logout` |
  - Behaviour: the only action that clears the local answer mirror. A failed logout call (network) still clears the local session and goes to `/login`; the server session expires by itself. ERR-AUTH-01 on a later call is the normal result of a logged-out Back press.
  - New requirements: FR-MUR-A5-4 A failed logout request still ends the local session and shows `/login`.
  - New acceptance criteria: AC-MUR-A5-5 Given the network is off, when "Log Keluar" is pressed, then `/login` shows and every `pp.bijak.local.*` key is removed from local storage.
- **Name**: "Log Keluar". **Route**: action in account menu (V2: icon in header and user card). **Matrix row**: A5. **Priority**: P0.
- **Current status**: works in V3 (account menu).
- **Outcome**: end the session safely on a shared device.
- **Reference behaviour**: POST logout, session destroyed, return to login. V2 also destroys the unsent Bijak attempt pin so a shared device starts blank.
- **Functional requirements**
  - FR-MUR-A5-1 "Log Keluar" is reachable in one tap from the account menu at every width.
  - FR-MUR-A5-2 On logout the token and local cached answers keys of the pupil are cleared; the server attempt keeps its saved answers.
  - FR-MUR-A5-3 After logout, Back does not show pupil data (pages call the API again and get 401).
- **Data and dependencies**: `POST /api/auth/logout` (M01).
- **Acceptance criteria**
  - AC-MUR-A5-1 Given a logged-in pupil, when "Log Keluar" is pressed, then `/login` shows.
  - AC-MUR-A5-2 Given logout then Back, then no pupil data appears.
  - AC-MUR-A5-3 Given an unsubmitted Bijak attempt with 2 saved answers, when the pupil logs out and in again, then the paper card shows "Sambung" and both answers are restored.
  - AC-MUR-A5-4 Given a 375x667 viewport, when the pupil opens the drawer and scrolls to its end, then the "Log Keluar" control is inside the viewport with a height and width of at least 44 px; at 768 and 1280 px it is in the account menu with the same minimum size; pressing it ends the session at each width.
- **Current gap**: none. **Fidelity deviations**: none. **Decisions applied**: none needed.

### R1-MUR-2 Dashboard
- **Action**: Complete
- **Screen specification (from V2)** (route `/dashboard`, browser title "Dashboard — PRESTASIPLUS"). Main column then a right rail (rail drops below at 375 px). Regions in order:
  1. Hero: "{greeting}, {pupil name} 👋" and "Jom teruskan latihan hari ini! 🚀", a 🎓 icon at the right.
  2. Card "Pakej SPM Aktif" with the package name (observed "Pakej Soalan Biasa"), badge "Aktif" and "Sah sehingga {d M YYYY}" (observed "3 Nov 2027").
  3. Kombo banner 🔥: "Kombo {n} hari!", "Jom mula latihan untuk teruskan streak!", pill "Belum", footer "Rekod terbaik: {n} hari" (observed 0 / 0).
  4. Five tiles, value above label: 🪙 "Syiling Kamu", ⭐ "Mata (Lvl {n})", 🔥 "Hari Berturut", 📋 "Sesi Minggu Ini", 🎯 "Ketepatan" (%). Zero-data pupil: 0, 0 (Lvl 1), 0, 0, 0%.
  5. Card "📱 Misi Harian" / "Selesaikan semua misi → buka Peti Harian! 🎁", "Progres" "{done} / {total}" (observed 1 / 3), three rows each with icon, text and a status box: "Selesai 5 kuiz" (⬜), "Capai ketepatan 80%" (⬜), "Login hari ini" (✅).
  6. Mood check-in, IN R1 (D114(b), D115; function from V2 `POST pelajar/mood`, `docs/discovery/v2-parity/student.md:53,111,152`): a V3-style component (V3 layout, not the V2 widget layout, FR-X1-6) asking "Bagaimana perasaan anda hari ini?" with four choices "😄 Gembira" (`happy`), "🙂 Okay" (`okay`), "😟 Sedih" (`sad`), "😣 Tertekan" (`stressed`). Result after a choice: "✓ {mood}" (from the reference behaviour; not captured). Full rules in FR-MUR-2-12.
  7. Card "⚡ Cabaran Kilat" with link "Lihat Semua →" (opens Cabaran Harian). Rows: icon, difficulty chip, name, description, progress bar, "{done}/{target}" and "🪙 +{n}". Observed: "Rajin Berlatih" / "Selesaikan 3 kuiz hari ini" 0/3 +15 (chip "easy"); "Si Tepat" / "Dapat 80% ketepatan dalam mana-mana kuiz" 0/80 +20 (chip "medium"); "Penjelajah Topik" / "Latih 3 topik berbeza hari ini" 0/3 +25 (chip "medium"). Chips are English in V2: defect, V3 shows "Mudah", "Sederhana", "Sukar".
  8. Card "📖 Subjek Tersedia" with link "Lihat Semua →" and subject chips (observed 8: Bahasa Melayu, Bahasa Inggeris, Matematik, Sains, Sejarah, Pendidikan Islam, Pendidikan Moral, Matematik Tambahan). A chip opens Latih Tubi for that subject (destination: Not observed in V2, the V2 links redirect back to the Dashboard — follow FR-MUR-2-7).
  9. Card "⚡ Soalan Terkini": five rows, each with subject name, difficulty stars (⭐ to ⭐⭐⭐⭐⭐) and the question text cut at about 140 characters. V2 lists figure questions ("Rajah 14 menunjukkan...") with no figure: V2 differs, see FR-MUR-2-8.
  10. Card "📊 Statistik Platform": three numbers labelled "Soalan Approved", "Total Soalan", "Subjek".
  11. Card "🎓 Tahap Pendidikan": three groups "🏫 Sekolah Rendah (KSSR)", "🎒 Sekolah Menengah Rendah (KSSM)", "🎓 Sekolah Menengah Atas (KSSM)", each listing levels with a count in brackets. V2 lists Darjah 1-6 in the first group: V2 differs, Darjah is removed (FR-MUR-SH-8); the other two groups list Tingkatan 1-3 and Tingkatan 4-5.
  12. Card "📈 Tahap Kesukaran": five bars labelled "⭐ Sangat Mudah", "⭐⭐ Mudah", "⭐⭐⭐ Sederhana", "⭐⭐⭐⭐ Sukar", "⭐⭐⭐⭐⭐ Sangat Sukar", each with a count.
  13. Card "📊 Statistik Subjek" with total "Jumlah Keseluruhan {n}" and one row per subject: subject name, "{n} soalan", "Kesukaran: ⭐…" (average stars). V2 lists 31 subjects, largest first.
  14. Right rail: card "📚 Artikel Untuk Kamu" with link "Lihat Semua" (opens `/artikel`) and five article rows (thumbnail, title cut with "...", category "Motivasi", relative date such as "8 months ago": English defect, V3 prints BM).
  - Empty, loading and error states: only "Tiada artikel buat masa ini." (reference behaviour) — otherwise Not observed in V2; follow FR-MUR-2-4 (card hidden when no package), FR-MUR-2-11 and FR-X6.
- **Corrections from the screens (earlier review)**: the screens confirm the order of blocks 1-5, 6 (mood: "Bagaimana perasaan anda hari ini?" with "Gembira", "Okay", "Sedih", "Tertekan"), 9-13. Corrections and additions: (a) "Cabaran Kilat" shows difficulty in English ("easy", "medium") and the Challenges page mixes "EASY/MEDIUM/HARD" with "MUDAH": PRD shows "Mudah", "Sederhana", "Sukar" (FD-MUR-35); (b) "Subjek Tersedia" shows 8 subject chips with "Lihat Semua →"; (c) "Statistik Platform" shows "Soalan Approved", "Total Soalan", "Subjek"; "Tahap Pendidikan" lists Darjah 1-6 and Tingkatan 1-5 in three groups — V2 differs: Darjah must not appear, PRD shows Tingkatan 1-5 only (D72); (d) "Soalan Terkini" lists questions such as "Rajah 14 menunjukkan dua tin ..." with no figure — V2 differs: PRD follows D90/D105 and never serves or lists a figure question without its figure; (e) the right rail shows the 5 articles with "Motivasi · {n} months ago" (English relative date; PRD uses BM "{n} bulan lalu").
- **Current gap and root cause (change list; reuse `src/modules/m05-practice/pages/DashboardPage.vue` and `GET /api/dashboard`)**: add the missing blocks only: Pakej SPM Aktif card, Kombo card and warning, mood check-in (Build, IN R1 per D114(b) and D115: the dashboard component `HomeMood.vue` and `POST /api/me/mood`, `GET /api/me/mood/today` are absent in V3; see FR-MUR-2-12, DM-84 `mood_checkins`, API-MUR-11, card S5-T04), Cabaran Kilat, Soalan Terkini, Statistik blocks; fix the "Subjek Tersedia" counts to D91; remove "Percubaan Percuma" per OQ-MUR-2. **Banner carousel and mascot (D114(d), D115):** the V2 pupil dashboard has neither (V2 regions are items 1 to 14 above; the carousel and the mascot popup are V1 and V3 additions), and they are visual only. **Kept as in V3 (D115, keep-V3-UI rule, FR-X1-6):** V3 already has the carousel (`src/modules/m05-practice/components/dashboard-v2/HomeCarousel.vue`, used by `DashboardPage.vue`) and the mascot; they are not removed, not restyled, and no V2 look is copied. The only requirement is that the data they show is real (no placeholder slides, no link to a hidden module, FR-MUR-2-10). No AC is added for their layout.
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Five tiles ("Syiling Kamu", "Mata (Lvl {n})", "Hari Berturut", "Sesi Minggu Ini", "Ketepatan") | read-only | - | 0 / 0 (Lvl 1) / 0 / 0 / "—" | wallet and `practice_answers`; Ketepatan per 0A.4; level = floor(XP/1000)+1 | - | - | - | `GET /api/dashboard` |
  | Pakej SPM Aktif card | read-only | - | hidden | the pupil's active package (name, badge "Aktif", "Sah sehingga {d M YYYY}"); when none and a free-trial quota exists the "Percubaan Percuma" card shows; else nothing | - | - | - | same |
  | Kombo banner | read-only | - | "Kombo 0 hari!" | pill "Belum" until a session today, then "Selesai"; warning `Kombo {n} hari akan putus!` when streak >= 1 and no session today | - | - | - | same |
  | Subjek Tersedia chips; "Lihat Semua →" | links | - | - | OPT-SUBJEK for the pupil's own form with "{n} soalan" (D91); order Subjek Teras first then name asc; at most 8 chips, then "Lihat Semua →" opens `/practice`; a chip opens `/practice/{code}` | - | - | - | API-PRAC-04 |
  | Topik Perlu Diperkuat, "Latih" | list + button | - | hidden when empty | at most 5 subjects with pooled accuracy under 60 over the last 30 days and at least 5 answers, worst first; "Latih" opens Latih Tubi of that subject for the pupil's own form | - | - | - | `GET /api/dashboard` |
  | Soalan Terkini | read-only list | - | - | 5 newest servable questions of the pupil's form, text cut to 140 characters | - | - | - | same |
  | Artikel Untuk Kamu | list | - | `Tiada artikel buat masa ini.` | 5 latest published articles; "Lihat Semua" opens `/artikel` | - | - | - | R1-MUR-20 |
  - Behaviour: the mood check-in IS built in R1 (D114(b); this reverses the D113 drop and OQ-MUR-10). The banner carousel and mascot are kept as in V3 (see the Current gap line); "Tukar Rakan Belajar" and the mascot chooser follow OQ-MUR-3. Empty/loading/error: 0A.1; one failed block shows its own card (ERR-SYS-01b) while the others render.
  - New requirements: FR-MUR-2-12 **Mood check-in (D115).** (a) Options, stored value and BM label: `happy` "😄 Gembira", `okay` "🙂 Okay", `sad` "😟 Sedih", `stressed` "😣 Tertekan" (OPT-MOOD, 40 §X11; the same four values V2 stores, `docs/architecture/v2-data-model.md:3013,3198`; the guru panel label "😊 Gembira / 😐 OK / 😢 Sedih" in 20 is the same four values). (b) Question "Bagaimana perasaan anda hari ini?"; after a choice the component shows "✓ {label}" and the choices are no longer offered for that day. (c) One check-in per pupil per Malaysia calendar day (`checked_in_on`, Asia/Kuala_Lumpur, 0A.7); a second submit on the same day answers 409 `ALREADY_CHECKED_IN` with `Anda sudah merekodkan perasaan hari ini.` and the dashboard shows the stored choice (D115 default: V2 stores `{user_id, mood, reason, checkin_date}`, the same-day rule is not observed in V2 discovery). (d) `reason` is optional free text, max 300, not asked in the pupil component in R1 (the Guru drill column "Sebab" shows "-"). (e) Wellbeing flag: V2 raises a wellbeing alert for `sad` and `stressed` (`student.md:53`). R1 keeps that function without a new table or screen: a `sad` or `stressed` check-in IS the flag; the Guru "Mood Pelajar" panel and drill and the Admin Sekolah "Aktiviti Harian" mood panel read it (20 R1-GUR-1, R1-AS-1; the V3 reads are already wired through `MoodReadPort`, `apps/api/src/modules/command-center/shared/ports.ts:26-36`, which today returns 0 because no table exists: `NoMood`, line 37). A separate `wellbeing_alerts` table and the `/wellbeing/alerts` screen are not in R1 (no matrix row). (f) Visibility: only the pupil, the pupil's own teachers and the school admin see a pupil's mood; never another pupil, never a public profile (PDPA, minors). (g) Roles: pupil only; any other role calling the endpoint gets 403 (40 FR-X2-4). **FR-MUR-2-13** The "Ketepatan" tile shows "—" for a pupil with 0 answers, and a whole number otherwise (0A.4).
  - New acceptance criteria: AC-MUR-2-8 Given a pupil who has not checked in today, when the Dashboard loads, then the question "Bagaimana perasaan anda hari ini?" and four choices "Gembira", "Okay", "Sedih", "Tertekan" show; when the pupil picks "Sedih", then "✓ Sedih" shows, a row exists with `mood = sad` for today, and after reload the choices are not offered again. AC-MUR-2-10 Given the same pupil submits a second check-in the same day by API, then 409 `ALREADY_CHECKED_IN` and the stored row is unchanged. AC-MUR-2-11 Given a pupil of a Guru's class checked in "Tertekan" today, when the Guru opens Command Center, then "Mood Pelajar" counts 1 for "😣 Tertekan" and the drill lists the pupil; the Admin Sekolah "Aktiviti Harian" mood panel counts it for the school (and no other school). AC-MUR-2-12 Given a Guru, Admin Sekolah or Admin Pusat calls `POST /api/me/mood`, then 403. AC-MUR-2-9 Given a pupil with 0 answers, then the "Ketepatan" tile shows "—" and no error shows.
- **Name**: "Dashboard" (subtitle "Selamat datang kembali")
- **Route**: `/dashboard`. **Matrix row**: 2. **Priority**: P1.
- **Current status**: V3 both: greeting with mascot, 3 stat cards (streak, koin, mata), "Teruskan Latih Tubi 0 daripada 10 misi harian", "Percubaan Percuma Baki 50 / 50 soalan", HERO/PROMO banner carousel, shortcuts. Missing: Pakej SPM Aktif, Kombo card, "Cabaran Kilat", "Soalan Terkini", mood check-in, "Subjek Tersedia" counts per D91.
- **Outcome**: one-page start: greeting, streak, missions, next action.
- **Reference behaviour (V2 `pelajar/dashboard.blade.php`)**, in order (desktop: main column plus 300 px right rail):
  1. Hero: "{Selamat Pagi|Selamat Tengah Hari|Selamat Petang|Selamat Malam}, {name} 👋", line "Jom teruskan latihan hari ini! 🚀". Time bands: before 12 Pagi; 12-14 Tengah Hari; 15-18 Petang; 19 and later Malam.
  2. Card "PAKEJ SPM AKTIF" with package name, badge "Aktif" and "Sah sehingga {j M Y}" (V2 hard-codes "Pakej Soalan Biasa" and today plus 1 year, FD-MUR-9).
  3. Kombo banner "Kombo {n} hari!" with text "Jom mula latihan untuk teruskan streak!" (no session this week) or "Tahniah, dah buat latihan minggu ini!", pill "Belum" or "Siap!", footer "Rekod terbaik: {n} hari". When streak > 0 and no session today an orange banner "Kombo {n} hari akan putus!" / "Jangan lepaskan! Buat sekurang-kurangnya 1 latihan hari ini." with button "Mula Latihan".
  4. Five tiles: "Syiling Kamu", "Mata (Lvl {n})" with progress bar, "Hari Berturut", "Sesi Minggu Ini" (sessions in last 7 days), "Ketepatan" (average session accuracy, %).
  5. **(Peti Harian, D115 audit mn-1: the line "Selesaikan semua misi → buka Peti Harian! 🎁" is V2 copy kept verbatim; V2 shows no chest screen or rule and none is observed in V2 discovery, so R1 builds no chest function. V1's chest is not brought back, D114.)** "Misi Harian" / "Selesaikan semua misi → buka Peti Harian! 🎁" with "Progres {x}/{y}" and mission rows (V3 uses the challenge list; V2 shows 3 hard-coded rows "Selesai 5 kuiz", "Capai ketepatan 80%", "Login hari ini", FD-MUR-10).
  6. Mood check-in "Bagaimana perasaan anda hari ini?" with "😄 Gembira", "🙂 Okay", "😟 Sedih", "😣 Tertekan"; chosen mood shows "✓ {mood}". Built in R1 (D114(b), FR-MUR-2-12).
  7. "Topik Perlu Diperkuat" / "Berdasarkan 30 hari lepas — fokus latihan di sini!": weak subjects (30 days) with % bar, "{betul}/{jumlah} betul" and button "Latih".
  8. "Set Soalan Dari Cikgu" (only when a teacher set exists) rows "Mula".
  9. "⚡ Cabaran Kilat" (today's challenges, progress, "🪙 +{n}", link "Lihat Semua →"), only when active.
  10. "📖 Subjek Tersedia" with "Lihat Semua →" and subject chips.
  11. "⚡ Soalan Terkini": 5 newest servable questions (subject, stars, text cut to 140 characters), read only.
  12. Statistik blocks: "📊 Statistik Platform" ("Soalan Approved", "Total Soalan", "Subjek"), "🎓 Tahap Pendidikan", "📈 Tahap Kesukaran", "📊 Statistik Subjek" ("{n} soalan", "Kesukaran: ⭐").
  13. Right rail: "📚 Artikel Untuk Kamu" with "Lihat Semua", five article rows; empty "Tiada artikel buat masa ini.".
  V1 adds: banner carousel and a free-trial card "Percubaan Percuma / Baki {n} / 50 soalan / Langgan Sekarang".
- **Functional requirements**
  - FR-MUR-2-1 Greeting uses server time in Malaysia time and the pupil's name.
  - FR-MUR-2-2 The five tiles use wallet and session data of the pupil; "Ketepatan" = the pupil's pooled accuracy (correct ÷ answered in the single answer store `practice_answers`, all modes, XS-5 and the FR-X4 precision list in 40-cross-cutting), shown as a whole-number percent (FD-MUR-11: V2 averages per-session accuracy, which disagrees with Prestasi).
  - FR-MUR-2-3 The Kombo card follows the wallet streak rule: first activity = 1; same day = unchanged; consecutive day +1; gap resets to 1. "Rekod terbaik" = longest run of consecutive practice days.
  - FR-MUR-2-4 "Pakej SPM Aktif" shows the pupil's real active package (name, validity) and is hidden when none exists; when none exists and a free-trial quota exists, the V1 "Percubaan Percuma" card shows instead (OQ-MUR-2).
  - FR-MUR-2-5 The missions widget shows today's challenges with real progress and "{done}/{total}"; its count is whatever is active (not a fixed 3 or 10).
  - FR-MUR-2-6 "Topik Perlu Diperkuat" lists subjects with accuracy under 60 in the last 30 days, worst first; the "Latih" button opens Latih Tubi for that subject of the pupil's own form (T1-T5) or Soalan by Chapter.
  - FR-MUR-2-7 "Subjek Tersedia" lists subjects that have servable questions for the pupil's own form (T1-T5, D101), counts per D91; a T1 pupil and a T5 pupil each see their own subjects and can start.
  - FR-MUR-2-8 "Soalan Terkini" shows the 5 newest servable questions of the pupil's form (text cut to 140 characters; a question with a figure shows the figure thumbnail), read only, with no answer key.
  - FR-MUR-2-9 The right rail "Artikel Untuk Kamu" shows the 5 latest published articles and "Lihat Semua" opens `/artikel`; the module Artikel (R1-MUR-20) is delivered with 1.0 as "1.0 (linked from R1-MUR-2)" with its sidebar item, so the link is never dead (D106).
  - FR-MUR-2-10 Shortcuts to modules that are hidden (Soalan Aku Salah, Kemajuan, Sejarah Latihan, Cikgu Alesa, Keluarga Angkat, and any banner or mascot link that points to them) are not rendered (the carousel and mascot themselves stay as in V3); every link that is rendered (Artikel, Cabaran Harian, Set Soalan Guru, Subjek, Papan Pendahulu) opens a working module delivered with 1.0 (D106); "Mula Latihan" opens Latih Tubi.
  - FR-MUR-2-11 Statistik blocks (item 12) show counts of servable questions for T1-T5 only (never Darjah), each equal to the surface definition of D91; blocks with no data are hidden. "Tahap Kesukaran" counts servable questions by the five-label difficulty (FR-MUR-16-3: difficulty 1 "Sangat Mudah" … 5 "Sangat Sukar"); "Kesukaran: ⭐…" in "Statistik Subjek" is the average of that difficulty, rounded to a whole star.
- **Data and dependencies**: wallet and streak (M14), sessions (M05), challenges (M14), packages (M19/school packages), articles (M09), questions counts (M04 via practice overview), `GET /api/dashboard` (exists). Mood: new table DM-84 `mood_checkins` and endpoints API-MUR-11 (S5-T04; owner module: M26 provisional, hosted with M17; the Command Center reads already exist).
- **Acceptance criteria**
  - AC-MUR-2-1 Given a pupil with streak 1 and no session today, when the Dashboard opens, then the card "Kombo 1 hari akan putus!" shows with "Mula Latihan".
  - AC-MUR-2-2 Given a T5 pupil on UAT, when "Subjek Tersedia" renders, then each count equals the count on the Latih Tubi card for the same subject (D91) and no Darjah level appears.
  - AC-MUR-2-3 Given a pupil with no package, then no "PAKEJ SPM AKTIF" card shows (never a fake package).
  - AC-MUR-2-4 Given the pupil completes one session, when Dashboard reloads, then "Sesi Minggu Ini" increases by 1 and "Ketepatan" equals the Prestasi "Ketepatan".
  - AC-MUR-2-5 Given 375 px, then tiles are two columns and the right rail moves below the main column.
  - AC-MUR-2-6 Given a T1 pupil and a test bank with at least 5 servable T1 Matematik MCQs (data precondition), when Dashboard loads, then "Subjek Tersedia" contains Matematik with "5 soalan" or more, tapping the chip opens Latih Tubi setup for Matematik T1, and the page text has no "akan datang".
  - AC-MUR-2-7 Given any dashboard link, when clicked, then it opens a 1.0 screen (no hidden module).
- **Current gap and root cause**: missing blocks (parity C01); extras from V1 (banner, trial, mascot) present; `/kombo` out of scope.
- **Fidelity deviations**: FD-MUR-9, FD-MUR-10, FD-MUR-11.
- **Decisions applied**: OQ-MUR-2, OQ-MUR-3, OQ-MUR-8, OQ-MUR-10. (decided in section 6.1)

### R1-MUR-3 Headcount
- **Action**: Complete
- **Screen specification (from V2)** (route `/headcount`, browser title "Headcount — PRESTASIPLUS"). Regions:
  1. Hero: title "Headcount", subtitle "Tracking prestasi murid — TOV, OTR, AR & RS".
  2. List area. Empty state (observed): 📋, "Belum ada Headcount", "Guru anda belum menyediakan headcount bagi kelas anda tahun ini.". No button in the empty state.
  3. A modal dialog is present in the page but opened by no visible control: title "Auto-Setup Headcount", sub-title "Pilih tingkatan untuk auto-cipta headcount", label "Tingkatan" with checkboxes "T1", "T2", "T3", "T4", "T5", buttons "Batal" and "Auto-Setup (0)". It is a teacher function leaked into the pupil page: not built (FR-MUR-3-6, FD-MUR-2).
  - Populated list (card fields, "Lihat Data Saya", own-detail page `/headcount/student/:ownId`): Not observed in V2 — follow FR-MUR-3-1 to FR-MUR-3-8 and the reference behaviour below. Loading and error: Not observed in V2 — follow FR-X6.
- **Corrections from the screens (earlier review)**: Confirmed: hero "Headcount" / "Tracking prestasi murid — TOV, OTR, AR & RS" and the empty state "Belum ada Headcount" / "Guru anda belum menyediakan headcount bagi kelas anda tahun ini."; the page also carries a hidden "Auto-Setup Headcount" dialog ("Pilih tingkatan untuk auto-cipta headcount", T1-T5, "Batal", "Auto-Setup (0)") that no button opens (FD-MUR-2: not built). Still open: a pupil WITH a class headcount (list cards, "Lihat Data Saya", detail page): see E-1.
- **Current gap and root cause (change list; reuse `HeadcountStudentPage.vue` and the S12-S15 pages)**: (1) `src/shells/nav/user-nav.ts:749` remove `headcount` from `STUDENT_HIDDEN_IDS`; (2) `src/modules/m08-student-performance/routes/headcount.ts:10-21` add `student` to the roles of `/headcount` and `/headcount/student/:id`; (3) API `headcounts` controller `@Roles('admin','teacher','school_admin')` (`headcount.controllers.ts:51-52`): add own-scope `GET /headcounts/me` and `/me/detail`; (4) hide the create, delete and Auto-Setup controls for the pupil.
- **Field & behaviour spec** (pupil view is read only; there is no input)
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Card per headcount; "Lihat Data Saya" | read-only + link | - | `Belum ada Headcount` / `Guru anda belum menyediakan headcount bagi kelas anda tahun ini.` | headcounts of the pupil's own classes for the current session year; one card per config (a config = one class, one subject, one mode, API-RPT-08), so a pupil with several configs has several cards and picks the config by opening its card: "Lihat Data Saya" goes to `/headcount/student/:ownId?configId={config id}` (API-RPT-08 takes `configId`; a missing or foreign `configId` answers 404); chips "Auto" / "Manual"; card status "Active" / "Draft" (OPT-STATUS-HEADCOUNT) | another id: 403 (ERR-ACC-01) with no existence leak | - | - | `headcounts` read (student role added) |
  | Checkpoint table | read-only | - | AR "—" when none | OTR_k and status per HC-SPEC (HC-2, HC-4): "On Track" / "Below" / "—" | - | - | - | same |
  - Behaviour: HC-1 to HC-6 of 20 (R1-GUR-3) are the only formulas; with n=3, TOV 40, RS 80 the fractions are 0.33 and 0.66 and OTR2 = 66 (K11 settled, AC-MUR-3-2 is correct). Auto AR = round(correct / answered x 100) over `practice_answers` of every mode in the config's year and subject; Manual AR is the teacher's key and may show one decimal. Grade scale of HC-5 is its own scale and is not merged with the Databank scale of 13 (two scales, one per feature). English words "Active", "Draft", "On Track", "Below Target" stay (OQ-MUR-12 decided). The Auto-Setup dialog and "Padam Headcount?" are not built for a pupil (B-058).
  - New requirements: FR-MUR-3-10 A pupil without an ETR in the config (no own value and no class default) sees the card pill "Draft" (OPT-STATUS-HEADCOUNT) and, in the card body where the targets would be, the one line "Belum Ada Data"; no checkpoint table and no error. "Draft" and "Belum Ada Data" always appear together, exactly when the pupil has no ETR for that config; a missing TOV alone does not show "Draft" or "Belum Ada Data"; when TOV is missing and ETR exists, Jurang and the OTR targets show "—" and the status pill reads "Belum Ada TOV" (R1 copy, D113; HC-SPEC). FR-MUR-3-11 The page title of both screens is "Headcount" and nothing prints "Dashboard" as a title.
  - New acceptance criteria: AC-MUR-3-9 Given a config where the pupil has no ETR, then the card shows the pill "Draft" and the line "Belum Ada Data" and no error.
- **Name**: "Headcount" (hero "Headcount", sub "Tracking prestasi murid — TOV, OTR, AR & RS")
- **Route**: `/headcount` (cards), `/headcount/student/:ownId` (own detail). **Matrix row**: 3. **Priority**: P0.
- **Current status**: V3 both: menu hidden (`STUDENT_HIDDEN_IDS`), route 403. Missing.
- **Outcome**: the pupil sees the targets the teacher set (TOV take-off, RS target) against own achievement (AR).
- **Reference behaviour (V2 `pelajar/headcount*.blade.php`)**
  - List: when none, card "📋 Belum ada Headcount" / "Guru anda belum menyediakan headcount bagi kelas anda tahun ini.". Otherwise one card per headcount of the pupil's class teachers for the current year: subject (name_bm), label "{Kelas} · {Tingkatan}", pill "Active" (the pupil's entry has TOV and RS/ETR, own or the class default set by the teacher's "Simpan Sasaran") or "Draft", "{n} murid", year, button "Lihat Data Saya" to the own detail.
  - Detail (page heading "Headcount — Sasaran (TOV → RS)", sub "Tracking prestasi anda — TOV, AR & RS", hero sub "Sasaran yang guru anda tetapkan, dan pencapaian sebenar anda"): info note "💡 **TOV** (Take-Off Value) dan **RS** (Realistic/Sasaran) ditetapkan oleh guru anda. **AR** (Achievement Rate) dikira secara langsung daripada latihan sebenar anda."; empty "Belum ada sasaran Headcount" / "Guru anda belum menetapkan sasaran TOV/RS bagi subjek anda tahun ini.". Per subject: "Sasaran TOV → RS", pill "AR {n}%" or "AR —" (title "Belum ada data AR"), tiles "TOV" and "RS (Sasaran)", chip "Jurang: +{RS-TOV}", "Sasaran tercapai" (AR at least RS) or "Belum capai sasaran". With both targets: "Unjuran: {n}% ({grade})", "Meningkat"/"Menurun", "Keyakinan: Tinggi|Sederhana|Rendah", badge "On Track"/"Below Target", chart (Target OTR dashed blue, Markah Sebenar AR green, Unjuran amber), table Checkpoint/Target/Gred/AR/Gred/Status for OTR1, OTR2, OTR3, "ETR (Sasaran Akhir)", note "Sasaran OTR interim dianggar linear (TOV → RS)...".
  - Rules: **this document defines no Headcount rule of its own.** TOV, RS (= the teacher's ETR), OTR1..OTRn, AR (Auto and Manual), Jurang, "On Track" / "Below", grade, Unjuran and Keyakinan are the single computation spec **HC-SPEC (HC-1 to HC-6) in `20-guru-admin-sekolah.md` R1-GUR-3**, which the teacher, the school admin (read-only), Prestasi, Dashboard and Command Center also use. The pupil view reuses it unchanged: AR in an Auto config is the pupil's pooled accuracy in that subject over `practice_answers` of every mode for the config's year (HC-3), shown as a whole-number percent; status is "On Track" when AR >= OTR_k and the pupil's status is that of the latest checkpoint that has an AR (HC-4). The earlier pupil-side variants (AR >= ETR, TOV/ETR midpoint, AR >= TOV) are removed.
- **Functional requirements**
  - FR-MUR-3-1 A pupil can open `/headcount` and `/headcount/student/:ownId`; any other id returns 403 (V2 rule) with no existence leak.
  - FR-MUR-3-2 The list shows only headcounts of the pupil's own classes for the current session year.
  - FR-MUR-3-3 The detail shows only the pupil's own AR and the teacher's TOV and RS; no classmate data.
  - FR-MUR-3-4 All formulas are those of HC-SPEC (R1-GUR-3), implemented once and shared with the teacher and school-admin screens; checkpoint rows show "—" for AR when none.
  - FR-MUR-3-5 Page title is "Headcount" (not "Dashboard"; FD-MUR-1).
  - FR-MUR-3-6 The pupil view is read only: no "Auto-Setup Headcount", no trash/"Padam Headcount?" (FD-MUR-2).
  - FR-MUR-3-7 Empty states use the exact copy above for both pages.
  - FR-MUR-3-8 Mixed-case status words "Active", "Draft", "On Track", "Below Target" stay as in V2 (English on live; OQ-MUR-12). The detail table's per-checkpoint status words are "On Track" and "Below" (HC-4).
  - FR-MUR-3-9 Each card carries the chip "Auto" or "Manual" of its config (HC-SPEC "What the pupil sees"). In a Manual config the pupil sees only the AR values the teacher keyed for that pupil ("—" where none); a pupil dropped from the config ("Gugurkan") does not see it. Never a classmate's value.
- **Data and dependencies**: headcounts (owner M08), the single answer store `practice_answers` (owner M05, all modes, 40-cross-cutting FR-X4-5). Teacher feed: teacher Headcount screens (cross-ref R1 guru PRD). API: `headcounts` is currently `@Roles('admin','teacher','school_admin')`; needed: `GET /api/headcounts/me` and `/me/detail` scoped to the caller, and the FE role list for `/headcount*` must add `student`.
- **Acceptance criteria**
  - AC-MUR-3-1 Given a pupil with a class headcount, when `/headcount` opens, then one card per headcount shows with "Lihat Data Saya".
  - AC-MUR-3-2 Given an Auto config with 3 OTRs, TOV 40, RS 80 and AR 60, then OTR1 = round(40 + 40 x 0.33) = 53, OTR2 = round(40 + 40 x 0.66) = 66, OTR3 = ETR = 80; "Jurang: +40"; "Belum capai sasaran" (AR 60 < RS 80); Keyakinan "Sederhana" (AR >= TOV, AR < RS); checkpoint rows OTR1 "On Track" (60 >= 53), OTR2 "Below" (60 < 66), OTR3 "Below" (60 < 80); pupil status "Below" (latest checkpoint, HC-4). The same inputs give the same numbers in AC-GUR-3-2 and on the teacher's table.
  - AC-MUR-3-3 Given a pupil with no headcount, then "Belum ada Headcount" shows with the exact sub-text.
  - AC-MUR-3-4 Given `/headcount/student/{another id}`, then 403.
  - AC-MUR-3-5 Given the pupil view, then no create, delete or Auto-Setup control exists in DOM or API.
  - AC-MUR-3-6 Given 375 px, then the checkpoint table scrolls inside its card and the chart fits.
  - AC-MUR-3-7 Given a class with default TOV 40 and RS 80 set by "Simpan Sasaran" and a pupil whose entry has no own values, then the pupil's card reads "Active" and shows TOV 40 and RS 80; given a config where the pupil has no ETR (RS) of their own and the class has no default ETR, then the card reads "Draft" with the line "Belum Ada Data" (FR-MUR-3-10); given a pupil who has an ETR but no TOV, the card does not read "Draft" and the missing TOV shows as "—".
  - AC-MUR-3-8 Given a Manual config where the teacher keyed AR 70 for the pupil at OTR1 and nothing else, then the pupil's detail shows AR 70 at OTR1 and "—" at the other checkpoints, the chip "Manual", and the OTR1 status "On Track" when OTR1 <= 70.
- **Current gap and root cause**: `user-nav.ts:749` `STUDENT_HIDDEN_IDS` contains `headcount`; `routes/headcount.ts` roles exclude student; BE controller roles exclude student.
- **Fidelity deviations**: FD-MUR-1, FD-MUR-2.
- **Decisions applied**: OQ-MUR-12. (decided in section 6.1)

### R1-MUR-4 Prestasi
- **Action**: Fix
- **Screen specification (from V2)** (route `/prestasi`, browser title "Prestasi — PRESTASIPLUS"). Regions, top to bottom:
  1. Hero: initial avatar, pupil name, "Prestasi 360 — Dashboard Individu", two mini stats "Ketepatan" (%) and "Hari Kombo".
  2. Four stat cards (icon, value, label): "Sesi Kuiz", "Ketepatan" (%), "Soalan Dijawab", "Masa Belajar" (e.g. "39m", "0m").
  3. Card "Headcount — Prestasi SPM". Empty (observed): "Belum ada sasaran headcount daripada cikgu untuk sesi 2026." (V3: current year). Populated: Not observed in V2 — follow the reference behaviour below.
  4. Card "Prestasi 360 — Trend Prestasi". Empty (observed): 📈 "Belum ada data prestasi lagi. Mula latihan →" (link goes to Latih Tubi). Populated chart: Not observed in V2 — follow the reference behaviour below.
  5. Card "Peta Aktiviti (90 Hari)": grid of 90 day cells and legend "0", "1-4", "5-8", "9-12", "13+", "sesi/hari".
  6. Section "Aktiviti" with link "Lihat Penuh" and four cards "Kombo Hari", "Rekod Terbaik", "Koin", "Hari Latihan" (observed 0, 0, 0, 0 for a pupil with no sessions; 1, 1, 0, 1 for a pupil with 2 sessions).
  7. Card "Cadangan". Empty (observed): 💡 "Belum cukup data untuk cadangan. Mula latihan →". Populated (observed, two rules): "Hari ini masih kosong — lakukan sekurang-kurangnya 1 sesi latihan untuk kekalkan kombo {n} hari." and "{Subjek} perlu perhatian segera — purata ketepatan hanya {x}%. Cuba ulang topik asas dahulu.".
  8. Card "Penguasaan Subjek": one tile per practised subject with initials badge (e.g. "SA"), subject name, progress bar with percentage, and "{n} sesi · {m} soalan" (observed "2 sesi · 120 soalan", 0%). Empty (observed): "Belum ada latihan. Mula sekarang →".
  - Weak-topic block: Not observed in V2 (shown only when data exists) — follow FR-MUR-4. Loading and error: Not observed in V2 — follow FR-X6.
- **Confirmed in the screens (earlier review)**: hero "Prestasi 360 — Dashboard Individu" with "Ketepatan" and "Hari Kombo"; cards "Sesi Kuiz", "Ketepatan", "Soalan Dijawab", "Masa Belajar" (e.g. "39m"); "Headcount — Prestasi SPM" empty text "Belum ada sasaran headcount daripada cikgu untuk sesi 2026."; "Prestasi 360 — Trend Prestasi"; "Peta Aktiviti (90 Hari)" with legend "0 1-4 5-8 9-12 13+ sesi/hari"; "Aktiviti" with "Lihat Penuh" and four cards; "Cadangan" (two rules shown verbatim); "Penguasaan Subjek" tile "Sains 0% 2 sesi · 120 soalan". The sample has no weak-topic block (shown only when data exists).
- **Current gap and root cause (change list; reuse `Prestasi360Page.vue` and `GET /api/performance/students/:userId`)**: (1) `src/modules/m08-student-performance/routes/prestasi.ts:29` `/prestasi` redirects to `/prestasi/sekolah`: for role student render the page in place at `/prestasi` (component route, no redirect; FR-MUR-4-13, AC-MUR-4-9; D115); the real BE today reads Bijak sittings only (S10-T01 builds the shared cross-mode reader), returns `weakTopics: []` and has no weekly trend: the response gains `trend: {week:'YYYY-MM-DD', label:'Mgg n', accuracy:number|null, sessions:number}[12]` (last 12 ISO weeks, Monday start); `Prestasi360Page.vue:59` `isHttpMode()` Bijak-only layout is removed; UI: keep the V3 layout; (2) `prestasi.ts:18-26` remove `student` from `PRESTASI_SCHOOL_ROLES` and `PRESTASI_CLASS_ROLES`; (3) page title and header "Prestasi Saya" / "Analisis pencapaian latihan anda"; (4) one accuracy formula (FD-MUR-11).
- **Field & behaviour spec** (Prestasi has no filter control; the windows are fixed)
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Hero counters (Soalan Dijawab, Ketepatan, Sesi Kuiz, Masa Belajar, Hari Latihan) | read-only | - | 0, "—", 0, "0m", 0 | Ketepatan per 0A.4; "Sesi Kuiz" counts practice sessions and Bijak sittings only (games add none, D-PA-18); Masa Belajar = sum of `timeSpent`, "{h}j {m}m" from 1 hour else "{m}m", minutes round down, `ditinggalkan` sessions excluded; Hari Latihan = distinct practice days (MYT) | - | - | - | Prestasi read |
  | Trend Prestasi | chart | - | empty copy of the screen specification | last 12 ISO weeks (Monday start), x labels "Mgg 1" … (the label is the week's relative index counted from the oldest of the 12 shown weeks: "Mgg 1" = the oldest, "Mgg 12" = the current week; it is not the ISO week number) | - | - | - | same |
  | Peta aktiviti | grid | - | - | last 90 days, shades per the screen specification | - | - | - | same |
  | Penguasaan Subjek bars | read-only | - | - | green at least 80, amber 60-79, red below 60 on the whole-number percent | - | - | - | same |
  | Topik Perlu Perhatian, "Fokus {n}" | list + button | - | hidden when empty | all time, at least 2 attempts and accuracy under 60; n = min(servable, 25) | no servable question: tile without a button | - | - | `focusSpId` / topic id on API-PRAC-01 |
  | Cadangan | read-only | - | - | all time | - | - | - | same |
  - Behaviour: a pupil sees only own data; `/prestasi` never redirects to the school dashboard (live defect; the school screens `/prestasi/sekolah`, `/prestasi/tingkatan*`, `/prestasi/kelas` answer 403 for a pupil, FR-MUR-4-2). A failed block shows its own card (ERR-SYS-01b); the page never goes blank.
  - New requirements: FR-MUR-4-13 `/prestasi` for role student renders Prestasi 360 and issues no redirect to any school or class dashboard (verified live gap). FR-MUR-4-14 removed (D115, D-B): the V2 screen has no "Sesi" list region; a Bijak sitting counts in "Sesi Kuiz" and in the Penguasaan tile "{n} sesi · {m} soalan".
  - New acceptance criteria: AC-MUR-4-9 Given a T5 pupil on UAT, when `/prestasi` is opened by URL, sidebar and Back, then the URL stays `/prestasi`, the title is "Prestasi Saya" and no school figure appears.
- **Name**: "Prestasi" (page "Prestasi Saya", sub "Analisis pencapaian latihan anda")
- **Route**: `/prestasi` (renders own Prestasi 360, `/prestasi/:ownId`). **Matrix row**: 4. **Priority**: P0 (data leak).
- **Current status**: V3 both **wrong**: `/prestasi` redirects to "Dashboard Sekolah" showing school-wide figures (UAT: "1 kelas · 2 murid", GPS Anggaran, Prestasi Guru). A pupil sees school data: privacy defect.
- **Outcome**: the pupil sees only own performance.
- **Reference behaviour (V2 `pelajar/prestasi.blade.php`)**
  1. Hero: initial, name, "Prestasi 360 — Dashboard Individu", mini stats "Ketepatan" (%) and "Hari Kombo" (desktop).
  2. Four cards: "Sesi Kuiz", "Ketepatan", "Soalan Dijawab", "Masa Belajar" ("{h}j {m}m" when at least 1 hour, else "{m}m").
  3. "Headcount — Prestasi SPM": empty "Belum ada sasaran headcount daripada cikgu untuk sesi {year}."; else cards: subject, "{kelas} · {year}", status pill "On Track"/"Below"/"—", chips "TOV: {n}%" → "AR: {n}%" → "ETR: {n}%", link "Lihat Penuh".
  4. "Prestasi 360 — Trend Prestasi": weekly line chart (accuracy left axis 0-100, sessions right axis), ISO weeks (Monday start), last 12 weeks, x labels "Mgg 1", "Mgg 2"... (relative index from the oldest shown week, not the ISO week number), legend "Ketepatan (%)" and "Sesi"; empty "Belum ada data prestasi lagi. Mula latihan →".
  5. "Peta Aktiviti (90 Hari)": 90 cells, oldest first; colours 0 #f1f5f9, 1-4 #bbf7d0, 5-8 #4ade80, 9-12 #16a34a, 13+ #15803d; tooltip "dd/mm (Hari) — {n} sesi latihan" or "Tiada aktiviti" (days Ahad, Isnin, Selasa, Rabu, Khamis, Jumaat, Sabtu); legend "0 1-4 5-8 9-12 13+ sesi/hari". (V1 legend labels "1-1, 2-2, 3-3" are a live quirk; V2 labels used.)
  6. "Aktiviti" with link "Lihat Penuh" (to `/headcount`): "Kombo Hari", "Rekod Terbaik", "Koin", "Hari Latihan" (distinct practice days).
  7. "Topik Perlu Perhatian" (only when any): topic, "{subject} · {n} percubaan", % (amber at least 50, red below), "Fokus {n} →".
  8. "Cadangan" rules: (a) sessions exist and none today: "Hari ini masih kosong — lakukan sekurang-kurangnya 1 sesi latihan untuk kekalkan kombo {max(1,streak)} hari."; (b) up to 2 subjects below 50% pooled accuracy (FR-MUR-4-4): "{subjek} perlu perhatian segera — purata ketepatan hanya {x}%. Cuba ulang topik asas dahulu."; (c) worst topic: "Topik '{topik}' ({acc}% ketepatan) adalah titik lemah utama — buat latihan tertumpu untuk topik ini."; (d) up to 2 headcounts with AR below ETR: "{subjek}: pencapaian semasa ({ar}%) masih {etr-ar} mata di bawah sasaran ETR ({etr}%). Fokus latihan untuk kejar target."; empty "Belum cukup data untuk cadangan. Mula latihan →".
  9. "Penguasaan Subjek": subject tile (two letters), name, bar (green at least 80, amber 60-79, red below 60), "{n} sesi · {m} soalan"; empty "Belum ada latihan. Mula sekarang →".
- **Functional requirements**
  - FR-MUR-4-1 `/prestasi` for role student renders the pupil's own Prestasi 360; the route `/prestasi/:userId` accepts only the own id (else 404, no existence leak; API already answers 404).
  - FR-MUR-4-2 `/prestasi/sekolah`, `/prestasi/tingkatan*`, `/prestasi/kelas` return 403 for a pupil (removes `student` from `PRESTASI_SCHOOL_ROLES` and `PRESTASI_CLASS_ROLES`). No school, class, teacher or other-pupil figure appears anywhere.
  - FR-MUR-4-3 Page title "Prestasi Saya" / "Analisis pencapaian latihan anda" (V3 inherits the V1 quirk "Dashboard"/"Selamat datang kembali", FD-MUR-1).
  - FR-MUR-4-4 "Ketepatan" = pooled accuracy = correct ÷ answered x 100 (XS-5; a self-marked part counts as correct only when it earned full marks) over the pupil's rows in `practice_answers` (all modes, FR-MUR-4-5), shown as a whole-number percent; hero, card, Dashboard, Profil and the SPM hub use the same number (V2 hero uses the mean of session accuracy; FD-MUR-11).
  - FR-MUR-4-5 Every pupil activity that answers questions writes its answers to the single answer store `practice_answers` (with a mode value) and Prestasi reads only that store: Latih Tubi, Soalan by Chapter, SPM Databank, Kuiz, Bijak sittings including Tracking A, Subjektif (self-marked parts), Set Soalan Guru, Simulasi, Misi, Remedial and question-based games (40-cross-cutting FR-X4-5 and the source table X4a). "Sesi" = one practice session or one Bijak sitting; "Soalan Dijawab" = answer rows; "Masa Belajar" = session time. The mode value is in the API contract (API-PRAC-01).
  - FR-MUR-4-6 Headcount block uses HC-SPEC (R1-GUR-3, HC-1 to HC-6) for status and chips; this document defines no second rule. Status pill: "On Track" / "Below" / "—" (no AR or no ETR). The block reads the pupil's own headcount entries from API-RPT-08 (role `student`, own rows only, FR-MUR-3-1); the rules and that read are built by card S10-T02; the Headcount block wiring is part 2 of card S10-T01, merged after S10-T02 (an ordering note, not a card dependency).
  - FR-MUR-4-7 Trend, 90-day map, Aktiviti, weak topics, Cadangan and Penguasaan are computed exactly as listed, from the pupil's own sessions only.
  - FR-MUR-4-8 "Topik Perlu Perhatian" uses topic (DSKP SP or chapter, whichever tag exists) with at least 2 attempts and accuracy under 60; "Fokus {n}" opens a Latih Tubi session of up to {n} servable questions on that topic (D91 count).
  - FR-MUR-4-9 Bijak sittings appear as a labelled subject-mode entry in Penguasaan/Sesi (existing `bijak-label` behaviour), their answers count like any other (FR-MUR-4-5), and the entry updates after a self-mark (R1-10.3).
  - FR-MUR-4-10 Empty states use the exact copy above; a new pupil sees zeros and no error.
  - FR-MUR-4-11 The page is not cached across users (`no-store`).
  - FR-MUR-4-12 Each metric on this page has one computation and one display precision, those of the metric table in 40-cross-cutting FR-X4-5 (Ketepatan whole-number percent; "Penguasaan Subjek" bar colours green at least 80, amber 60-79, red below 60 as listed in the threshold table of X4); the same pupil, window and metric show the same value on the teacher, school-admin and Admin Pusat screens.
- **Data and dependencies**: practice sessions and answers (M05), wallet streak (M14), headcounts (M08), curriculum tags (M03). API: `GET /api/performance/students/:userId` (exists; own scope).
- **Acceptance criteria**
  - AC-MUR-4-1 Given a T5 pupil on UAT, when `/prestasi` opens, then the hero shows the pupil's name and "Prestasi 360 — Dashboard Individu", and no text "Dashboard Sekolah", "GPS", "Prestasi Guru", or any school or class count ("kelas", "murid") appears; the pupil's own class name inside the Headcount block ("{kelas} · {Tingkatan}") is allowed. The hero line is "Prestasi 360 — Dashboard Individu" and the page title (heading and browser title) is "Prestasi Saya": two different elements, both kept (the route `/prestasi/:userId` is declared in `routes/analitik.ts`, the redirect fix is in `routes/prestasi.ts`).
  - AC-MUR-4-2 Given pupil A, when A requests `/api/performance/students/{B}`, then 404.
  - AC-MUR-4-3 Given pupil A, when A types `/prestasi/sekolah`, then 403.
  - AC-MUR-4-4 Given a pupil with 3 sessions in week 1 and 1 in week 2, then the trend has two points with the correct accuracy and session counts; with only these two weeks of data, the weeks with sessions are the last two of the 12 and carry the labels "Mgg 11" and "Mgg 12" (the weeks before them show a gap, labels "Mgg 1" to "Mgg 10").
  - AC-MUR-4-5 Given a pupil with sessions of 10 questions (6 correct) and 20 questions (20 correct), then "Ketepatan" is 87 on the hero and on the card (26/30 = 86.67, shown as the whole number 87) and "Soalan Dijawab" is 30.
  - AC-MUR-4-6 Given a pupil with no data, then "Belum ada data prestasi lagi." and "Belum ada latihan." show and no console error.
  - AC-MUR-4-8 Given a pupil with 10 Latih Tubi answers (7 correct) and one Bijak sitting of 40 MCQ marks (30 correct), then Prestasi shows "Sesi Kuiz" 2, "Soalan Dijawab" 50 and "Ketepatan" 74 (37/50 = 74.0), the sitting is counted in "Sesi Kuiz" and in the Penguasaan tile of its subject, and the teacher Prestasi Kelas, the school-admin Prestasi and the Admin Pusat Laporan show the same 50 answers and 74 for this pupil (AC-X4-1).
  - AC-MUR-4-7 Given a pupil with 90 days of data and a 375x667 viewport, when `/prestasi` loads, then the hero mini-stats "Ketepatan" and "Hari Kombo" are not displayed (they are shown from 1024 px only), the 90 map cells occupy more than one row and none extends beyond the container's right edge, the four stat cards are in 2 columns, and `scrollWidth <= innerWidth`.
- **Current gap and root cause**: `routes/prestasi.ts:29` redirect `/prestasi` to `/prestasi/sekolah`; `PRESTASI_SCHOOL_ROLES` (line 18) contains `student`; `/prestasi/:userId` (`routes/analitik.ts:30`) exists but is not the menu target. V1 (FR-M08-13) showed the own-school view to a pupil; that conflicts with V2 and with privacy and is superseded (FD-MUR-3).
- **Fidelity deviations**: FD-MUR-1, FD-MUR-3, FD-MUR-11.
- **Decisions applied**: none needed.

### R1-MUR-5 Analitik Adaptif
- **Action**: Complete
- **Screen specification (from V2)** (route `/analitik/pelajar`, browser title "Analitik Pembelajaran — PRESTASIPLUS"). Observed for a pupil with no practice. Regions:
  1. Subject tab bar, one tab per subject that has a DSKP map (14 observed: Bahasa Melayu, Matematik, Fizik, Geografi, Sains, Pendidikan Seni Visual, Bahasa Inggeris, Pendidikan Islam, Matematik Tambahan, Ekonomi, Perniagaan, Tasawwur Islam, Pendidikan Moral, Sejarah). The first tab is open by default.
  2. Summary of the open subject: "{n}" "/ {total} SP" with caption "Standard Dikuasai" (observed "0 / 26 SP" for Bahasa Melayu, "0 / 52 SP" for Matematik); four counters "{n} Mahir", "{n} Sederhana", "{n} Lemah", "{n} Belum Cuba" (observed 0, 0, 0, 26); "Ketepatan" ("—" when no answers); "Soalan Dijawab" (0).
  3. Empty message (observed): "Belum ada latihan untuk {Subjek}. Mula berlatih untuk membuka analitik penuh.".
  4. Footnote (observed, V2 only): "Trend, unjuran gred dan perbandingan kelas belum tersedia untuk sekolah ini." (V2 differs: V3 has trend and projection, FD-MUR-12; the footnote is not shown when they exist).
  5. Map "Peta DSKP — Standard Pembelajaran · {Subjek}": strand headings with one chip per standard (SP) code such as "1.1.1". Bahasa Melayu strands: "Kemahiran Mendengar dan Bertutur", "Kemahiran Membaca", "Kemahiran Menulis", "Aspek Seni Bahasa". Matematik (Tingkatan 5) strands start with "Ubahan", "Matriks", "Matematik Pengguna: Insurans", "Matematik Pengguna: Percukaian", "Kekongruenan, Pembesaran dan Gabungan Transformasi", "Nisbah dan Graf Fungsi Trigonometri", "Sukatan Serakan Data Terkumpul".
  6. Legend: "Mahir (75%+)", "Sederhana (50-74%)", "Lemah (<50%)", "Belum Cuba", and the hint "Fokus Klik untuk latihan fokus" (clicking a chip starts focused practice for that standard; destination Not observed in V2 — follow FR-MUR-5).
  - Populated states (Topik Perlu Perhatian Utama, trend, grade projection, Lemah/Sederhana/Mahir counts above 0): Not observed in V2 — follow the reference behaviour below and FR-MUR-5-*. Loading and error: Not observed in V2 — follow FR-X6.
- **Confirmed in the screens (earlier review)** (settles FR-MUR-5-2): the tab bar lists all 14 subjects that have an SP map, not only practised ones; per subject "0 / 26 SP" (BM), "0 / 52 SP" (Matematik) with legend "0 Mahir", "0 Sederhana", "0 Lemah", "26 Belum Cuba"; "Ketepatan" shows "—" and "Soalan Dijawab" "0"; message "Belum ada latihan untuk Bahasa Melayu. Mula berlatih untuk membuka analitik penuh."; footnote "Trend, unjuran gred dan perbandingan kelas belum tersedia untuk sekolah ini."; "Peta DSKP — Standard Pembelajaran · {Subjek}" grouped by strand (BM: "Kemahiran Mendengar dan Bertutur", "Kemahiran Membaca", "Kemahiran Menulis", "Aspek Seni Bahasa"; Matematik T5 starts with "Ubahan"); legend "Mahir (75%+)", "Sederhana (50-74%)", "Lemah (<50%)", "Belum Cuba", "Fokus Klik untuk latihan fokus". V2 differs: the footnote says trend and grade projection are unavailable, while V3 has them (FD-MUR-12).
- **Current gap and root cause (change list; reuse `AnalitikPelajarPage.vue`, `GET /api/analytics/me`)**: show the tab for every subject that has SP nodes (today only subjects with data); keep trend and projection; show "—" for accuracy when there are no answers.
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Subject tab bar | tabs | - | first tab with data, else the first | every subject that has an SP map, in the order returned by API-DSKP; label = subject name, with data "{Subjek} {acc}%" | - | - | `subjectCode` in the URL | API-DSKP-05 |
  | SP chips (Mahir (75%+), Sederhana (50-74%), Lemah (<50%), Belum Cuba) | read-only / button | - | - | bands on the whole-number percent | an SP with 0 servable questions: tile without a link | - | - | - |
  | Latihan Fokus ({n} soalan) | button | - | - | n = min(servable, 25); opens `/practice/{code}/quiz` with `focusSpId` | - | - | - | API-PRAC-01 |
  - Behaviour: per DSKP rule D112(3), a subject with no loaded DSKP nodes shows its tab with the empty copy of the screen specification; SP/TP/aras are required only where DSKP nodes exist. Empty and failed blocks follow 0A.1.
  - New requirements: FR-MUR-5-8 The default tab is the first subject with at least one answer, else the first tab; the tab is kept in the URL (0A.6).
  - New acceptance criteria: AC-MUR-5-6 Given subject Fizik has an SP with 0 servable questions, then that tile has no link and no error.
- **Name**: "Analitik Adaptif" (page "Analitik Pembelajaran", sub "Pantau prestasi dan kenal pasti topik yang perlu diperkukuhkan")
- **Route**: `/analitik/pelajar`. **Matrix row**: 5. **Priority**: P1.
- **Current status**: V3 both works for subjects that have data (Topik Perlu Perhatian, SP Standard, 30-day trend, grade projection, DSKP map, Fokus). Subject tabs only for subjects with data (V2 shows all 14).
- **Outcome**: find weak DSKP topics and master standards per subject.
- **Reference behaviour (V2 `pelajar/analitik.blade.php`, V1 S7)**
  1. "💡 Topik Perlu Perhatian Utama ({n})": weakest 4 topics (all subjects), % pill (amber at least 50, red below), topic, "{Subjek} · {n} soalan dijawab", button "Latihan Fokus ({n} soalan)" (V1 count cap 25; V2 uses the available count). Beyond 4: "Masih ada {n-4} topik lemah lain untuk subjek ini." and "Lihat semua {n} topik lemah →" / "Tunjuk kurang ↑".
  2. Subject tab per subject with the % ("{Subjek} {acc}%").
  3. Per subject: ring "Standard Dikuasai" ("{mahir} / {total} SP"; legend Mahir, Sederhana, Lemah, Belum Cuba); tiles "Ketepatan" and "Soalan Dijawab"; message "{mahir} daripada {total} Standard Pembelajaran sudah dikuasai untuk {subjek}." plus " Masih ada {belum} SP belum dicuba." or, with no practice, "Belum ada latihan untuk {subjek}. Mula berlatih untuk membuka analitik penuh."; footer "Trend, unjuran gred dan perbandingan kelas belum tersedia untuk sekolah ini." (V2 omits trend; V3 shows trend and grade projection, kept, FD-MUR-12).
  4. "Peta DSKP — Standard Pembelajaran · {Subjek}": tiles per SP grouped by strand; Mahir 75% and above (green), Sederhana 50-74 (yellow), Lemah below 50 (red), "Belum cuba" (grey); title "{kod}: {title} — {label} — Klik untuk {n} soalan fokus".
- **Functional requirements**
  - FR-MUR-5-1 Own data only (`GET /api/analytics/me`).
  - FR-MUR-5-2 Subject tabs list every subject that has an SP map for the pupil's level (not only subjects with attempts); a subject with no attempts shows the "Belum ada latihan" message.
  - FR-MUR-5-3 SP bands: at least 75% Mahir, 50-74 Sederhana, below 50 Lemah, none Belum cuba; accuracy of an SP = correct/attempts over the pupil's attempts tagged to that SP.
  - FR-MUR-5-4 "Latihan Fokus" opens a Latih Tubi session limited to that SP and capped at the servable count (D91); a SP with 0 servable questions shows the tile without a link.
  - FR-MUR-5-5 The map shows the DSKP SP nodes that exist for the pupil's form (nodes are loaded for T4-T5 only, U1); a T1-T3 pupil sees the same tabs and screens with every SP "Belum cuba" or no SP map and no error (D101); no Darjah label (V1 showed "KSSR ... Darjah 4").
  - FR-MUR-5-6 Empty (no attempts anywhere): the exact message above for the first subject, no error.
  - FR-MUR-5-7 Tabs scroll horizontally inside their bar on small screens.
- **Data and dependencies**: curriculum SP nodes (owner M03; admin DSKP loader R1-ADM), question SP tags, attempts (M05). On UAT SP tags are 0 for migrated questions (D89, "Belum ditanda DSKP"), so the map is empty until tagged.
- **Acceptance criteria**
  - AC-MUR-5-1 Given a pupil with 3 SPs at 80, 60, 30%, then tiles are green, yellow, red and the ring reads "1 / {total} SP".
  - AC-MUR-5-2 Given a subject without attempts, then the message "Belum ada latihan untuk {subjek}. Mula berlatih untuk membuka analitik penuh." shows.
  - AC-MUR-5-3 Given a T5 pupil on UAT whose questions have no SP tags, then the page shows the tabs with empty maps and no error (documented dependency, not a defect).
  - AC-MUR-5-4 Given 375 px, then the tab bar scrolls and tiles wrap.
  - AC-MUR-5-5 Given any tile click, then the Latih Tubi session contains only that SP's questions.
- **Current gap and root cause**: subject picker limited to subjects with data (`analytics.service`); SP data empty on UAT.
- **Fidelity deviations**: FD-MUR-12.
- **Decisions applied**: none needed.

### R1-MUR-6 Analisa Item
- **Action**: Build
- **Screen specification (from V2)** (route `/analisa-item`, browser title "Analisa Item — PRESTASIPLUS"). Observed only for a pupil with 0 answers. Regions:
  1. Link "Kembali ke Papan Pemuka" at the top (opens `/dashboard`).
  2. Four tiles, icon, label under value: 📝 "Soalan Dijawab" (0), 🚨 "Perlu Pemulihan" (0), 💪 "Perlu Pengukuhan" (0), 🏆 "Tahap Penguasaan" (0%).
  3. Empty state (observed): 📊 "Belum ada data untuk dianalisa" / "Mulakan latihan untuk melihat analisa item peribadi anda di sini." and link "Mula Berlatih →" (opens Latih Tubi).
  - Populated layout (Subjek Perlu Perhatian, chips, Isyarat Awal, Pemulihan, Pengukuhan lists): Not observed in V2 — follow the reference behaviour below and FR-MUR-6-*. Loading and error: Not observed in V2 — follow FR-X6.
- **Confirmed in the screens (earlier review)**: Confirmed only for the empty state: link "Kembali ke Papan Pemuka", four tiles (0, 0, 0, "0%"), "Belum ada data untuk dianalisa" / "Mulakan latihan untuk melihat analisa item peribadi anda di sini." / "Mula Berlatih →". The populated layout (Subjek Perlu Perhatian, chips, Isyarat Awal, Pemulihan, Pengukuhan) is NOT in the screens and stays as quoted below from the V2 view: see E-2.
- **Current gap and root cause (change list)**: no pupil page exists: (1) `src/modules/m08-student-performance/routes/analisa-item.ts:13-18,43` `analisaItemTarget` sends a student home: add a pupil route and page; (2) `src/shells/nav/user-nav.ts:749` remove `analisa-item` from `STUDENT_HIDDEN_IDS`; (3) API: add own-scope `GET /api/item-analysis/me`; remove `student` from `GET /api/item-analysis/school` roles (`reports/performance/http/performance.controllers.ts:118,124`) and from `ITEM_SCHOOL_ROLES`; the path `/analisa-item` is currently a `redirect:` record (`routes/analisa-item.ts:43`) and becomes a component route (`AnalisaItemMuridPage.vue`) with a `beforeEnter` guard for the other roles (D115).
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Tapis Item: Semua / Ada Betul / Selalu Salah | chips | - | Semua | wire values `semua`, `ada_betul` (correct >= 1), `selalu_salah` (questions the pupil answered at least twice, every answer wrong, within the filter scope of Subjek + period), the names of API-RPT-05; applies to every items list of Analisa Item (60 section 2.17.6), not to the tiles | - | - | query `tapis` | Analisa Item read |
  | Ulang Kaji Subjek Ini | button | - | - | opens `/practice/revision/:subject` | - | - | - | API-PRAC-01 mode `revision` |
  | Penjelasan | toggle on an item card | - | closed | only when the question has an explanation | - | - | - | - |
  - Behaviour: categories — Pemulihan: attempts >= 2 and correct = 0; Pengukuhan: attempts >= 2 and 0 < correct < attempts; Isyarat Awal: attempts = 1 and correct = 0; "Subjek Perlu Perhatian" by accuracy ascending (pill red below 60). Inside a list: attempts descending, then last attempt descending. Reads `practice_answers` of every mode (games included). The page is a Build: it does not exist yet.
  - New requirements: FR-MUR-6-10 Questions in the lists are the ones the pupil answered, shown with their stimulus once. FR-MUR-6-11 A pupil with no answers sees the empty copy of the screen specification.
  - New acceptance criteria: AC-MUR-6-8 Given a pupil who answered a Battle question wrongly twice, then that question appears under Pemulihan.
- **Name**: "Analisa Item" (sub "Pemulihan & Pengukuhan berdasarkan jawapan sebenar anda")
- **Route**: `/analisa-item`. **Matrix row**: 6. **Priority**: P0.
- **Current status**: V3 both: menu hidden; `/analisa-item` redirects a pupil to Dashboard. Also `GET /api/item-analysis/school` allows role `student` (school-wide item data reachable by a pupil: privacy defect).
- **Outcome**: the pupil learns which questions to revise (always wrong) and strengthen (sometimes wrong).
- **Reference behaviour (V2 `pelajar/analisa-item.blade.php`, `StudentParityController::analisaItem`)**
  - Link "Kembali ke Papan Pemuka" (to `/dashboard`).
  - Four tiles: "Soalan Dijawab" (total attempts), "Perlu Pemulihan", "Perlu Pengukuhan", "Tahap Penguasaan" (pooled correct ÷ answered, whole-number %, FR-X4-5; V2 printed one decimal, FD-MUR-38).
  - Empty (0 attempts): 📊 "Belum ada data untuk dianalisa" / "Mulakan latihan untuk melihat analisa item peribadi anda di sini." and button "Mula Berlatih →".
  - Section "Subjek Perlu Perhatian Sekarang" / "Ringkasan ini guna SEMUA percubaan anda, jadi subjek boleh muncul di sini walaupun item yang sama belum diulang.": per subject card with "{n} percubaan · {m} soalan unik", accuracy pill (red below 60), rows "Jawapan salah" (`wrongAnswers`: the pupil's answer rows of that subject with is_correct false), "Item berulang lemah" (`weakRepeated`: distinct questions of that subject in Pemulihan or Pengukuhan), "Isyarat awal lemah" (`earlySignalWeak`: distinct questions of that subject in Isyarat Awal), button "Ulang Kaji Subjek Ini". Sorted by accuracy ascending.
  - Filter chips "Tapis Item:" "Semua", "Ada Betul", "Selalu Salah".
  - "Isyarat Awal — Soalan Baru Yang Masih Lemah" / "Soalan yang baru dicuba SEKALI tetapi masih salah — membantu kesan subjek lemah lebih awal." (hidden when empty).
  - "Pemulihan — Soalan Yang Perlu Diperbaiki" / "Soalan yang kamu SELALU jawab salah (≥2 percubaan, 0% betul). Fokus ulang kaji di sini." with count "{n} soalan"; empty "Tiada soalan dalam kategori ini setakat ini.".
  - "Pengukuhan — Soalan Yang Perlu Diperkukuhkan" / "Kamu jawab betul kadang-kadang, tapi belum kukuh (≥2 percubaan, sebahagian betul). Latih lagi!"; same empty line.
  - Footer note explaining that Pemulihan and Pengukuhan use questions answered at least 2 times while Subjek Perlu Perhatian and Isyarat Awal use all attempts.
  - Each item card: question text, subject, Bab/tag, source, attempts and correct, explanation toggle. Rules: per question over the pupil's own attempts on servable questions; Pemulihan = attempts at least 2 and correct 0; Pengukuhan = attempts at least 2 and 0 < correct < attempts; Isyarat Awal = attempts 1 and correct 0.
- **Functional requirements**
  - FR-MUR-6-1 A pupil opens `/analisa-item` (own page); the redirect to Dashboard is removed for student.
  - FR-MUR-6-2 Data is the pupil's own attempts only; the school and class item-analysis routes return 403 for a pupil, including `GET /api/item-analysis/school` (remove `student` from its roles).
  - FR-MUR-6-3 Tiles and the three categories use the exact rules above, over the pupil's rows in the single answer store `practice_answers` from every mode (FR-MUR-4-5), so a question answered in Latih Tubi and again in a Bijak sitting or a Set Soalan counts both attempts. "Soalan Dijawab" is answer rows (XS-4); "Soalan Unik" is distinct questions (XS-7).
  - FR-MUR-6-4 The subject list, filter chips and empty states use the exact BM copy.
  - FR-MUR-6-5 Each item card renders the question per section 4.6 (text, maths, figure) and shows "Penjelasan" only when the question has one; an archived question no longer appears.
  - FR-MUR-6-6 "Ulang Kaji Subjek Ini" opens a revision drill of that subject's wrong items using the Latih Tubi engine (the page `/practice/revision/:subject`, reached only from here, stays a hidden-menu route).
  - FR-MUR-6-7 Group member questions (D90) and figure questions are shown with their stimulus or figure above (D105), once per group.
  - FR-MUR-6-8 The page uses no school figures and no "Pelajar Yang Salah" class lists (those are teacher screens).
  - FR-MUR-6-9 Counts update after each new attempt on next load.
- **Data and dependencies**: attempts per question (owner M05), question text and explanation (owner M04). API: needed `GET /api/item-analysis/me`; existing `school` endpoint must refuse student.
- **Acceptance criteria**
  - AC-MUR-6-1 Given a pupil with a question answered wrong twice, then it appears under "Pemulihan" and "Perlu Pemulihan" is 1.
  - AC-MUR-6-2 Given a question answered right then wrong, then it appears under "Pengukuhan".
  - AC-MUR-6-3 Given a question answered wrong once, then it appears under "Isyarat Awal" only.
  - AC-MUR-6-4 Given a pupil with no attempts, then "Belum ada data untuk dianalisa" and "Mula Berlatih →" show.
  - AC-MUR-6-5 Given a pupil calls `/api/item-analysis/school`, then 403.
  - AC-MUR-6-6 Given 375 px, then tiles are two columns and item cards stack with no sideways scroll.
  - AC-MUR-6-7 Given a question answered wrong once in Latih Tubi and wrong once in a Bijak sitting (two rows in `practice_answers`, different modes), then it appears under "Pemulihan" with 2 percubaan and 0 betul, and "Perlu Pemulihan" is 1.
- **Current gap and root cause**: `analisa-item.ts:43` `analisaItemTarget` returns the home path for student; `STUDENT_HIDDEN_IDS` includes `analisa-item`; BE controller line 118 lists `student` for school scope.
- **Fidelity deviations**: none besides the added privacy refusal on school scope (FD-MUR-3).
- **Decisions applied**: none needed.

### R1-MUR-7 Video
- **Action**: Keep
- **Screen specification (from V2)** (route `/video`, browser title "Video Pembelajaran — PRESTASIPLUS"). Regions:
  1. Category pills with counts: "Semua (0)", "Motivasi (0)", "Tutorial (0)", "Tips SPM (0)", "Ceramah (0)", "Lain-lain (0)"; selecting a pill filters the grid.
  2. Empty state (observed): "Tiada video buat masa ini" / "Video pembelajaran akan dipaparkan di sini".
  3. No "Tambah Video" button is shown to a pupil.
  - Search box, subject pills, populated grid, pager and the detail page `/video/:id`: Not observed in V2 — follow the reference behaviour below and FR-MUR-7-*. Loading and error: Not observed in V2 — follow FR-X6.
- **Corrections from the screens (earlier review)**: Corrections (closes E-3 for the empty state): the pupil page shows the pills "Semua (0)", "Motivasi (0)", "Tutorial (0)", "Tips SPM (0)", "Ceramah (0)", "Lain-lain (0)" and the empty state "Tiada video buat masa ini" / "Video pembelajaran akan dipaparkan di sini"; no "Tambah Video" button is shown to the pupil (FR-MUR-7-5: hidden for pupils). Search and the populated grid are not in the screens: see E-3b.
- **Current gap and root cause**: None. Verify the ACs only.
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Cari video... | search | Tidak | empty | matches title and description, case-insensitive, 300 ms debounce, 2 to 100 characters | none found: `Tiada Video Dijumpai` / `Cuba ubah carian atau pilih kategori lain.` and a link "Lihat Semua Video" | - | query `q` | videos read |
  | Category pills | chips | Tidak | Semua | OPT-KATEGORI-VIDEO with "(n)"; a pill with 0 is disabled | - | - | query `kategori` | same |
  | Subject pills | chips | Tidak | none | subjects that have videos | - | - | query `subjek` | same |
  | Pager | buttons | - | page 1, 24 per page | "Sebelum" / "Seterusnya", `Halaman {p} daripada {n}`; newest first; filters kept | - | - | query `halaman` | same |
  - Behaviour: "Tambah Video" is not rendered for a pupil (OQ-MUR-11 decided: hidden). The detail page `/video/:id` for an unknown id is ERR-ACC-02.
  - New requirements: FR-MUR-7-6 A filter change resets the page to 1. FR-MUR-7-7 `/video/:id` of an unpublished video answers ERR-ACC-02.
  - New acceptance criteria: AC-MUR-7-5 Given 30 videos, then page 1 shows 24, page 2 shows 6 and the search term survives a reload.
- **Name**: "Video" (page "Video Pembelajaran", sub "Perpustakaan video pembelajaran anda"; V1 sub "Tonton video motivasi, tutorial dan tips peperiksaan")
- **Route**: `/video`, `/video/:id`. **Matrix row**: 7. **Priority**: P2.
- **Current status**: V3 both matches (category tabs, seed videos). 
- **Outcome**: watch learning videos.
- **Reference behaviour (V1 M09 S17-S18, V2 `content/video.blade.php`)**: search "Cari video..."; category pills with counts "Semua (n)", "Motivasi", "Tutorial", "Tips SPM", "Ceramah", "Lain-lain" (V1: a pill with 0 links to `#`, a dead link: FD-MUR-13); subject pills; grid of 24 per page: thumbnail, platform chip, title, uploader, "{n} tontonan", relative date; pager. Empty: "Tiada Video Dijumpai" / "Cuba ubah carian atau pilih kategori lain." / "Lihat Semua Video" (V2 empty list "Tiada video buat masa ini"). Detail: back link "Semua Video", embedded player, "{n} tontonan", chips, "Video Berkaitan" (6 same subject).
- **Functional requirements**
  - FR-MUR-7-1 Pills show counts that match the list; a zero-count pill is disabled, never a dead link.
  - FR-MUR-7-2 Search keeps the category and subject; the pager keeps all filters.
  - FR-MUR-7-3 Opening a video increments its views once per pupil per day.
  - FR-MUR-7-4 Empty state copy as above.
  - FR-MUR-7-5 "Tambah Video" appears only if V2 allows a pupil to add (OQ-MUR-11); otherwise hidden.
- **Data and dependencies**: videos (owner M09); admin feed: admin Video screen is missing in V3 admin (GAP section 5.1; cross-ref the admin PRD video row).
- **Acceptance criteria**
  - AC-MUR-7-1 Given a category with 0 videos, then its pill is disabled and not a link.
  - AC-MUR-7-2 Given a search with no match, then "Tiada Video Dijumpai" shows with "Lihat Semua Video".
  - AC-MUR-7-3 Given a video opened twice on one day, then views increase once.
  - AC-MUR-7-4 Given 375 px, then the grid is one column and pills scroll.
- **Current gap**: none for pupils; admin cannot manage videos (cross-module).
- **Fidelity deviations**: FD-MUR-13. **Decisions applied**: OQ-MUR-11. (decided in section 6.1)

### R1-MUR-8 Kelas Saya
- **Action**: Fix (remove the V3 join-by-code box; V2 has none, D-A8)
- **Screen specification (from V2)** (route `/kelas-saya`, browser title "Kelas Saya — PRESTASIPLUS"). Observed for a pupil in no class. One region: empty state with heading "Anda belum dimasukkan ke dalam kelas" and text "Guru anda yang menambah pelajar ke dalam kelas. Minta guru anda menambah nama anda supaya anda boleh melihat set soalan kelas dan kedudukan kelas." No button. Populated class card, class detail, set and ranking links: Not observed in V2 — follow the reference behaviour below and FR-MUR-8-*. Loading and error: Not observed in V2 — follow FR-X6.
- **Confirmed in the screens (earlier review)**: Confirmed: empty state "Anda belum dimasukkan ke dalam kelas" with the two-line explanation, exactly as quoted. The populated class card is not in the screens (see E-13b).
- **Current gap and root cause (change list)**: (1) remove "Masukkan Kod Kelas" and "Sertai" from the page and `POST /api/kelas-saya/join` (API-MUR-04) from the pupil API; (2) classmates show the display name (4.3); (3) the rest is verified only (the two shortcut buttons point to modules delivered with 1.0, FR-MUR-8-4). V2 evidence: the pupil page for a pupil in no class says "Guru anda yang menambah pelajar ke dalam kelas" and shows no field or button; the teacher also adds pupils by name (R1-GUR-8).
- **Field & behaviour spec** (no input: the join box and the class code are removed, D-A8)
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Class card, "Rakan sekelas" list | read-only | - | `Anda belum dimasukkan ke dalam kelas` | classmates by Syiling descending then name; first name only, never an initial, surname, school or photo (0A.3); own row marked "ANDA" | - | - | - | classes read |
  | Link "Papan Pendahulu" | link | - | - | opens `/leaderboard` | - | - | - | - |
  - Behaviour: there is no `POST` to join a class for a pupil; the join endpoint is removed. Empty text uses the exact copy of the screen specification.
  - New requirements: FR-MUR-8-7 Classmates are shown by first name only (0A.3).
  - New acceptance criteria: AC-MUR-8-5 Given a class of 3 pupils with surnames, then the list shows first names only and no school.
- **Name**: "Kelas Saya" (sub "Kelas yang anda sertai, guru dan rakan sekelas anda")
- **Route**: `/kelas-saya`. **Matrix row**: 8. **Priority**: P1.
- **Current status**: V3 both works (class list); V3 adds "Masukkan Kod Kelas" + "Sertai" (not in V2, removed by FR-MUR-8-3).
- **Outcome**: see own classes, teacher and classmates.
- **Reference behaviour (V2 `pelajar/kelas-saya.blade.php`)**: empty card "Anda belum dimasukkan ke dalam kelas" / "Guru anda yang menambah pelajar ke dalam kelas. Minta guru anda menambah nama anda supaya anda boleh melihat set soalan kelas dan kedudukan kelas.". Class card: name, badge "AKTIF"/"TAMAT", "SESI {year}", "{Tahap} · {Sekolah}" ("Sekolah tidak dinyatakan"), "Guru: {name}" ("Belum ditetapkan"), count "Pelajar", list "Rakan sekelas" ordered by syiling descending with rank, own row highlighted with "ANDA" and syiling; buttons "Set soalan guru" and "Papan pendahulu kelas".
- **Functional requirements**
  - FR-MUR-8-1 Lists only the pupil's own classes.
  - FR-MUR-8-2 Classmates show the display name (first name only, section 4.3) and syiling only (no e-mail, accuracy, surname or other data).
  - FR-MUR-8-3 There is no pupil "Sertai" box and no class code: a pupil is in a class only because the teacher or the school admin added them (R1-GUR-8, V2 sentence "Guru anda yang menambah pelajar ke dalam kelas"). "Masukkan Kod Kelas", "Sertai" and `POST /api/kelas-saya/join` do not exist (closes OQ-X-3; the class `join_code` is not shown to a pupil).
  - FR-MUR-8-4 The buttons "Set soalan guru" (to Set Soalan Guru, row 26) and "Papan pendahulu kelas" (to Papan Pendahulu with the class scope, row 33) are shown and work (both are delivered with 1.0 as "1.0 (linked from R1-MUR-8)", D106); empty copy is the exact V2 sentence.
  - FR-MUR-8-5 Ranking order and ties follow wallet syiling descending, then name.
  - FR-MUR-8-6 Class from a Darjah level is not listed (D72).
- **Data and dependencies**: classes (owner M10), wallet. Teacher feed: teacher Kelas Saya (guru PRD).
- **Acceptance criteria**
  - AC-MUR-8-1 Given a pupil in no class, then the exact empty text shows.
  - AC-MUR-8-2 Given a class of 3 pupils, then 3 rows with own row marked "ANDA".
  - AC-MUR-8-3 Given a pupil's Kelas Saya page (with or without a class), then no field "Masukkan Kod Kelas" and no button "Sertai" exist in the DOM, and `POST /api/kelas-saya/join` returns 404; given the teacher adds the pupil to a class, then the class appears on the pupil's next load without any action by the pupil.
  - AC-MUR-8-4 Given 375 px, then the classmate grid is one column.
- **Current gap**: join box and join endpoint (see above). **Fidelity deviations**: none (FD-MUR-14 withdrawn by D100). **Decisions applied**: OQ-X-3 closed (section 6.1).

### R1-MUR-9 Soalan by Chapter
- **Action**: Fix
- **Screen specification (from V2)** (V2 route `/latih-tubi/bab`, V3 route `/practice/chapter`; browser title "Soalan by Chapter — PRESTASIPLUS"). Subject index regions:
  1. Hero: kicker "Mode Sistematik", title "Soalan by Chapter", sentence "Pelajar jawab bab demi bab. Bab seterusnya hanya terbuka selepas bab sebelumnya lengkap dan mencapai sekurang-kurangnya 70%." (V2 only: the 70% copy is removed, D98), button "Latih Tubi Rawak" (opens random Latih Tubi; V2 sends the pupil back to the Dashboard because the flag is off, so the destination is `/practice` in V3).
  2. Grid of 14 subject cards. Each card: subject name, "{n} bab tersedia", "{m} soalan chapter". Observed order and bab counts: Bahasa Melayu 26, Bahasa Inggeris 34, Matematik 52, Sains 81, Sejarah 51, Pendidikan Islam 33, Pendidikan Moral 72, Matematik Tambahan 63, Fizik 97, Geografi 38, Pendidikan Seni Visual 37, Ekonomi 31, Perniagaan 42, Tasawwur Islam 29; every card showed "0 soalan chapter". A card opens the subject page.
  Subject page (V2 `/latih-tubi/bab/{kod}`, title "Soalan by Chapter — {Subjek} — PRESTASIPLUS"):
  3. Hero: kicker "Mode Sistematik", subject name, sentence "Jawab bab demi bab. Bab seterusnya hanya terbuka selepas bab sebelumnya lengkap dan mencapai sekurang-kurangnya 70%." (removed in V3, D98), back button "Semua Subjek".
  4. Note "Nota penguasaan: capai sekurang-kurangnya 70% dalam sesuatu bab sebelum meneruskan ke bab seterusnya." (removed in V3, D98).
  5. Chapter rows: number tile (V2 shows "1" on every row: defect, V3 shows the real number), title (V2 uses a DSKP learning-standard sentence, e.g. "Mendengar dan memberikan respons dalam pelbagai jenis ayat tanpa mengubah maksud konteks ayat."; V3 uses the admin-chosen Bab title, D89), level chip (observed "Tingkatan 5"), question count "0 soalan", status chip "Tiada soalan" when there are none. What a row with questions shows and where it goes: Not observed in V2 — follow FR-MUR-9-* and section 4.6.
  - Loading and error: Not observed in V2 — follow FR-X6.
- **Confirmed in the screens (earlier review)**: Confirmed: hero "Mode Sistematik" / "Soalan by Chapter" with the 70% sentence and button "Latih Tubi Rawak"; 14 subject cards "{n} bab tersedia" / "{n} soalan chapter" (BM 26, BI 34, Matematik 52, Sains 81, Sejarah 51, PI 33, PM 72, Matematik Tambahan 63, Fizik 97, Geografi 38, PSV 37, Ekonomi 31, Perniagaan 42, Tasawwur 29; every one "0 soalan chapter"); subject page with "Semua Subjek", the note "Nota penguasaan: capai sekurang-kurangnya 70% dalam sesuatu bab sebelum meneruskan ke bab seterusnya.", rows with a number tile, title, level chip ("Tingkatan 5"), "0 soalan" and the chip "Tiada soalan". **V2 differs**: (a) V2's "bab" are DSKP learning-standard sentences (e.g. "Menentukan hubungan antara dua pemboleh ubah bagi ubahan langsung.") and every number tile reads "1" (a V2 defect); (b) V2 lists 0 questions on every chapter; (c) the 70% sentence is copy only. PRD follows D89 (the admin chooses the textbook Bab; the pupil sees Bab with real counts), D98 (no 70% lock, no 70% copy) and D90/D105 for the questions.
- **Current gap and root cause (change list; reuse `ChapterIndexPage.vue`, `ChapterSubjectPage.vue`, `practice/chapter-subjects`; the 70% sentence and the lock are ALREADY absent from the V3 FE: regression test only; real gaps are in plan S5-T02)**: (1) remove the lower-form gate (`ChapterIndexPage.vue:21,48-51`, `src/lib/lower-form.ts:6-10`); (2) remove the sentence "Bab seterusnya terkunci sehingga bab semasa lengkap." from the Latih Tubi banner (`PracticeListPage.vue`) and any 70% copy; (3) number the chapters with their real number; (4) serve figure questions and whole groups (`be09-practice-mapping.ts:27-39` drops them today); (5) data: admin sets Bab (D89; 0 of 339,112 UAT questions have one), see OQ-MUR-6.
- **End-to-end flow**: see 46 section 4.9 (D2 Soalan by Chapter) and 46 section 2 (shared answering engine), 46 section 3 (marking). This block keeps only the fields specific to the module.
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Pilih Tahap (level select on the chapter list) | select | Ya | the pupil's own Tingkatan | OPT-TINGKATAN: only forms with chapters that have servable questions, label "Tingkatan {n}" with the chapter count; no "Semua" | - | - | query `tahap` | `practice/chapter-subjects` |
  | Subject cards | link cards | - | - | subjects of that form with at least one chapter with a servable question: "{n} bab tersedia", "{n} soalan chapter" (D91); Subjek Teras first then name asc | empty: `Tiada subjek bab tersedia untuk tahap ini.` | level | - | same |
  | Chapter row buttons "5 soalan", "10 soalan", "15 soalan", "20 soalan" | 4 buttons, start at once | - | none | OPT-BILANGAN-LT; chapters in textbook order (`chapter.number` ascending); a button beyond the available count is disabled with the title `Hanya {n} soalan tersedia.`; a chapter with fewer than 5 servable shows one button "Mula ({n} soalan)"; a chapter with 0 shows the chip "Tiada soalan" | list empty: `Tiada bab tersedia untuk tahap ini.` | chapter | session `mode=chapter`, `chapterId`, `clientUuid` | API-PRAC-01 |
  | Latih Tubi Rawak / Semua Subjek | links | - | - | `/practice` and `/practice/chapter` | - | - | - | - |
  - Behaviour: no chapter is locked and the "70%" sentence of V2 is not shown (D98). T1-T3 pupils see and start their own chapters like T4-T5 (D101): the `lib/lower-form.ts` gate is removed. A question that cites "Rajah n"/"Maklumat di bawah"/"Sumber"/"Teks"/"Petikan" without its stimulus asset is not served; a question whose stem text equals another served question is shown ONCE and NOT excluded (D113: the duplicate copy is a separate admin issue, never a pupil-side exclusion). Leaving mid-drill, refresh/resume and the session states follow 46 section 2.6 and 2.8 (dialog B-050 copy: title `Keluar daripada kuiz?`, body `Jawapan yang sudah disemak telah disimpan. Anda boleh menyambung semula kuiz ini.`, buttons "Keluar" / "Teruskan Kuiz"). Errors: ERR-PRAC-02 (`Soalan tidak mencukupi.`), ERR-PRAC-01, ERR-NET-*, ERR-SYS-*.
  - New requirements: FR-MUR-9-12 A chapter whose servable count is below the chosen count disables that button with the title above. FR-MUR-9-13 A question whose stem text equals another served question is served once and is not excluded or counted twice (D113). FR-MUR-9-14 The chapter session writes rows of mode `chapter` to `practice_answers` (46 section 4.9).
  - New acceptance criteria: AC-MUR-9-10 Given a chapter with 7 servable questions, then "5 soalan" is enabled and "10 soalan", "15 soalan", "20 soalan" are disabled with `Hanya 7 soalan tersedia.`. AC-MUR-9-11 Given two chapter questions with the same stem text, then both can be drawn, each appears once in the quiz and the count includes both. AC-MUR-9-12 Given a T1 pupil with servable T1 chapter questions, then the subject list shows them and no text contains "akan datang".
- **Name**: "Soalan by Chapter" (hero kicker "Mode Sistematik")
- **Route**: `/practice/chapter`, `/practice/chapter/:code`, `/practice/chapter/:code/:chapterId/quiz`. **Matrix row**: 9. **Priority**: P0.
- **Current status**: GitHub: one subject, 0 chapters ("Tiada bab tersedia untuk tahap ini."). UAT: T5 "Tiada subjek bab tersedia untuk tahap ini."; T1 "Kandungan akan datang". Root cause: 0 of 339,112 UAT questions carry a chapter (D89).
- **Outcome**: practise chapter by chapter in textbook order.
- **Reference behaviour**
  - V2 index (`latih-tubi/bab.blade.php`): hero "Mode Sistematik" / "Soalan by Chapter" / V2 text "Pelajar jawab bab demi bab. Bab seterusnya hanya terbuka selepas bab sebelumnya lengkap dan mencapai sekurang-kurangnya 70%." and button "Latih Tubi Rawak"; one card per subject with at least one chapter: name, "{n} bab tersedia", "{n} soalan chapter"; empty "Belum ada bab tersedia. Bab akan dipaparkan sebaik sahaja bank soalan mengikut bab dimuatkan.".
  - V2 subject page: hero with subject, "Semua Subjek" back; the V2 text repeats the 70% rule and a note "Nota penguasaan: capai sekurang-kurangnya 70% dalam sesuatu bab sebelum meneruskan ke bab seterusnya."; rows with number tile, "Bab" title, level chip, "{n} soalan", button "Mula" or locked chip "Tiada soalan" (title "Belum ada soalan untuk bab ini"); empty "Belum ada bab untuk subjek ini.".
  - V1 (M05 S5): level select, chapter cards "Bab {n}: {name}", stats "{a}/{b} soalan unik · Skor {s}% · {r} baki", four buttons "5 soalan", "10 soalan", "15 soalan", "20 soalan", real lock chip "Kunci bab sebelumnya" and unlock at all questions answered and 70%.
  - **Conflict and winner**: V1 enforces the 70% lock; V2 only prints the sentence and does not lock (`Mula` goes to the subject, not the chapter); **D98 (user) says no lock, every chapter open**. D98 wins. The 70% sentences are removed (a contradictory rule on screen is a D9 defect, FD-MUR-15). V3 hero text "Pelajar jawab bab demi bab." stays.
  - **Chapter source**: the admin picks the Bab for each question (D89, `question_versions.chapter_id`); not derived from DSKP. A question cannot be published without Bab, SP and TP/aras (admin gate, R1-ADM Studio, D-A5; each required where the Subjek + Tingkatan has chapters / DSKP nodes, D112), so every newly published question reaches this page and the Heatmap; the pupil surfaces show published questions only. Legacy questions published before the gate and still without a Bab never appear here and are listed to the admin in the work-list "Soalan tanpa Bab", so none is lost silently.
- **Functional requirements**
  - FR-MUR-9-1 Index lists subjects of the pupil's own form (T1-T5, D101) that have at least one chapter with at least one servable question, each with "{n} bab tersedia" and "{n} soalan chapter" where n = servable MCQ questions linked to a chapter, including figure questions and members of stimulus groups (D91, D105).
  - FR-MUR-9-2 Subject page lists all chapters of the subject and level in textbook order; every chapter is open (no lock, no "Kunci bab sebelumnya").
  - FR-MUR-9-3 Each chapter row shows "Bab {n}: {title}", "{x} soalan" and the buttons "5 soalan", "10 soalan", "15 soalan", "20 soalan" (V1 set; buttons beyond the available count are disabled); a chapter with 0 servable questions shows the chip "Tiada soalan" and an empty-state line (D89: "clear empty-state message").
  - FR-MUR-9-4 Start opens the chapter quiz (4.6 and R1-MUR-16 engine) drawing only questions linked to that chapter; the start button goes to the chapter, not to the subject.
  - FR-MUR-9-5 Level select shows Tingkatan 1 to Tingkatan 5 that have chapters with servable questions, with counts; default = the pupil's own form (D101).
  - FR-MUR-9-6 Progress per chapter shows "{a}/{b} soalan unik · Skor {s}%" (V1), information only.
  - FR-MUR-9-7 "Latih Tubi Rawak" opens `/practice`.
  - FR-MUR-9-8 T1-T3 pupils see their own chapters and can start, exactly as T4-T5 pupils (D101); the "Kandungan akan datang" gate (`lib/lower-form.ts:6-10`) is removed from this page; a level with no chapter questions shows the data empty state of FR-MUR-9-10.
  - FR-MUR-9-9 Questions follow 4.6: MCQ questions including figure questions and whole stimulus groups (figure shown once, group never split, D90/D105); an item whose figure is missing or whose mode is not built is excluded with the admin-visible "Dilihat murid di" reason; marking, rewards and sessions as R1-MUR-16 with mode `chapter`.
  - FR-MUR-9-10 Empty subject list: "Tiada subjek bab tersedia untuk tahap ini."; chapter list empty: "Tiada bab tersedia untuk tahap ini.".
  - FR-MUR-9-11 The count on the index equals the number drawable on the subject page and in the quiz (D91).
- **Data and dependencies**: curriculum chapters (owner M03; 686 T4/T5 chapters exist on UAT), question Bab link (owner M04). **Admin feed**: Studio question form "Bab" select (D89, cross-ref R1-ADM Studio) and bulk Bab assignment for legacy questions (needed; OQ-MUR-6). API: `practice/chapter-subjects`, `practice/sessions` (exist).
- **Acceptance criteria**
  - AC-MUR-9-1 Given an admin sets Bab "Bab 1" on one approved MCQ of Matematik T5 (and no other Matematik T5 question has a Bab), when a T5 pupil opens Soalan by Chapter, then Matematik shows "1 bab tersedia" and "1 soalan chapter" and chapter 1 offers a quiz. Given instead that the admin saves and publishes a new approved MCQ for Matematik T5 with Bab "Bab 1" through the Studio wizard (not the bulk tool), then the T5 pupil's Soalan by Chapter shows "1 soalan" in Bab 1 on the next load (the AC-CHAIN-1 path).
  - AC-MUR-9-2 Given chapter 3 and chapter 1 with 0% scores, then chapter 3 is startable (no lock).
  - AC-MUR-9-3 Given a chapter with 0 servable questions, then "Tiada soalan" shows and no quiz starts.
  - AC-MUR-9-4 Given a data-empty form (no question of that form has a Bab; test fixture), when the pupil opens Soalan by Chapter, then the index shows "Tiada subjek bab tersedia untuk tahap ini." and no card; this is the data-empty state only. **Acceptance of the module requires a fixture or UAT state in which at least 3 subjects have chapters with servable questions and AC-MUR-9-1 passes; an empty module is not a pass (D100).**
  - AC-MUR-9-5 Given a T1 pupil and a T5 pupil, and a data precondition that Sains has at least 1 chapter with 5 servable MCQs for T1 and for T5, when each opens Soalan by Chapter, then each sees their own subjects and chapters and can start a quiz; no "akan datang" text appears for either.
  - AC-MUR-9-6 Given a chapter with one stimulus group of 3 members and 2 single MCQs, when the pupil starts "10 soalan", then the quiz serves all 5 questions, the 3 members adjacent with the figure shown once above them, and the chapter row shows "5 soalan".
  - AC-MUR-9-9 Given a legacy approved Matematik T5 question with no Bab, then it is not counted or listed in Soalan by Chapter, it appears in the admin work-list "Soalan tanpa Bab", and after the admin sets its Bab it appears in the chapter count on the next load.
  - AC-MUR-9-7 Given 375 px, then subject cards are one column, chapter titles wrap (not truncated without a way to read, V1 defect D-13) and buttons wrap.
  - AC-MUR-9-8 Given a chapter-linked question whose stem cites "Rajah n" but has no figure asset, when the chapter quiz is built, then it is not served and not counted in "{x} soalan" (4.8); a question whose stem text appears twice is shown once and is still served and counted (D113).
- **Current gap and root cause**: `curriculum_nodes`/chapter links empty on UAT; MCQ bridge `be09-practice-mapping.ts:27-39` drops richer items; Latih Tubi page banner still prints "Bab seterusnya terkunci sehingga bab semasa lengkap." (contradicts D98).
- **Fidelity deviations**: FD-MUR-15 (no 70% lock or copy, D98), FD-MUR-16 (Bab chosen by admin, D89), FD-MUR-17 (figure questions and whole groups served, D105).
- **Decisions applied**: OQ-MUR-1, OQ-MUR-6. (decided in section 6.1)

### R1-MUR-12 Remedial
- **Action**: Complete
- **Screen specification (from V2), second page and empty state** (route `/remedial/saya` for a pupil with no weak subject; and the related screen `/practice/revision`, which is hidden in V3): with no weak subject the page shows "Tiada topik lemah!" / "Prestasi anda baik merentas semua subjek. Teruskan!" / "Terus Berlatih →" (this button lands on the Dashboard in V2 because Latih Tubi is flagged OFF; PRD sends it to Latih Tubi). New screen "Soalan Aku Salah" (`/practice/revision`, reached from Analisa Item and the Dashboard shortcut): sub "Ulang kaji soalan yang pernah dijawab salah — berdasarkan jawapan terkini anda", empty "Tiada soalan perlu diulang kaji!" / "Setakat ini semua jawapan terkini anda betul. Teruskan berlatih!" with "Terus Berlatih →" and "Kembali ke Latihan"; the populated subject list is not observed.
- **Screen specification (from V2)** (route `/remedial/saya`, browser title "Ujian Remedial Saya — PRESTASIPLUS"). Regions:
  1. Hero: 🔬, title "Ujian Remedial Saya", subtitle "Ujian khas untuk topik yang perlu diperbaiki".
  2. Section heading "Perlu Pemulihan Sekarang" with one card per weak subject. Card fields (observed): subject name, status badge "Perlu Pemulihan", "{n} soalan", "Ketepatan: {x}%" (observed "0.0%"), "Sasaran: 60%", chip "{Subjek} (Umum)", button "🎯 Latihan Pemulihan →".
  3. Button "🎯 Latihan Pemulihan →" opens the revision page `/practice/revision/{id}` titled "Ulang Kaji {Subjek}". Observed result: 🎉 "Tiada soalan salah untuk Sains buat masa ini." / "Jawapan terkini anda untuk subjek ini sudah betul." and button "Kembali" (back to Ujian Remedial Saya). This contradicts the card (0.0% over 120 questions): V3 shows a card only when its drill has questions (FR-MUR-12-3, FD-MUR-36).
  4. Empty state (no weak subject; text from the earlier capture above): "Tiada topik lemah!" / "Prestasi anda baik merentas semua subjek. Teruskan!" and button "Terus Berlatih →" (V3: opens Latih Tubi).
  - Populated revision page (list of wrong questions): Not observed in V2 — follow FR-MUR-12-* and section 4.6. Loading and error: Not observed in V2 — follow FR-X6.
- **Confirmed in the screens (earlier review)**: Confirmed: "Ujian Remedial Saya" / "Ujian khas untuk topik yang perlu diperbaiki", section "Perlu Pemulihan Sekarang", card "Sains" with "Perlu Pemulihan", "120 soalan", "Ketepatan: 0.0%", "Sasaran: 60%", chip "Sains (Umum)", "🎯 Latihan Pemulihan →". **V2 differs**: pressing "Latihan Pemulihan" opens "Ulang Kaji Sains" with "Tiada soalan salah untuk Sains buat masa ini." / "Jawapan terkini anda untuk subjek ini sudah betul." / "Kembali" although the card says 0.0% over 120 questions (a contradiction, FD-MUR-36): PRD: a card is shown only when its drill has questions (FR-MUR-12-3).
- **Current gap and root cause (change list; reuse `remedial-tests/mine` and the page)**: add the derivation of weak-subject cards (pooled accuracy below 60%) and the completed-set history; build the drill from wrong servable questions, else the weakest topics of that subject; no new screen.
- **End-to-end flow**: see 46 section 4.10 (D3 Remedial and Ulang Kaji). This block keeps only the fields specific to the module.
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Perlu Pemulihan Sekarang cards | read-only | - | not listed when no subject qualifies | a subject qualifies when the pupil's pooled accuracy in it is below 60 (target 60); "{n} soalan" = the pupil's answers in that subject; "Ketepatan" whole number | - | - | - | Remedial read |
  | Latihan Pemulihan / Ulang Latihan / Terus Berlatih | buttons | - | - | revision drill, session `mode=revision`; length = min(20, available); selection: the pupil's wrong questions whose LATEST answer is wrong and still servable, most recent wrong first; when fewer than 5, top up from the weakest topics of that subject (topic accuracy ascending, at least 2 attempts, never-correct questions first) until 20 or exhausted; "Terus Berlatih →" opens `/practice` | 422 only when both lists are empty: `Maaf, terdapat masalah memuatkan kuiz ulang kaji.` (ERR-PRAC-03); the card is then not listed, so the pupil cannot reach it | - | rows of mode `remedial` / `revision` | API-PRAC-01 |
  | Sebelum / Selepas / difference | read-only | - | - | Sebelum = pooled accuracy of the subject before the drill; Selepas = the drill accuracy; difference with sign and colour, whole numbers | - | - | - | - |
  - Behaviour: the drill is the Latih Tubi engine (46 section 4.10); archived questions drop out; an empty page shows the exact copy of the screen specification.
  - New requirements: FR-MUR-12-7 The drill selection and top-up rule above is the only selection rule. FR-MUR-12-8 A pupil with 0 answers sees the empty state and no error.
  - New acceptance criteria: AC-MUR-12-5 Given a subject with 3 wrong servable questions and a weak topic, then the drill has 3 wrong questions first and is topped up from the weakest topic up to 20 or the topic's size. AC-MUR-12-6 Given a wrong question later answered correctly, then it is not in the next drill.
- **Name**: "Remedial" (page "Ujian Remedial Saya", sub "Ujian khas untuk topik yang perlu diperbaiki")
- **Route**: `/remedial/saya`, `/remedial/:id`. **Matrix row**: 12. **Priority**: P1.
- **Current status**: V3 both: "Tiada ujian remedial. Bagus" (only teacher-assigned tests). V2 auto-generates cards from weak subjects.
- **Outcome**: a clear list of what to remedy and a way to do it.
- **Reference behaviour (V2 `pelajar/remedial.blade.php`)**: header "Ujian Remedial Saya"; list of completed remedial sets (revision drills): "Remedial Set {n} — {Subjek} — {name}", badge "Selesai", "{n} soalan", "Sebelum: {x}%", "Selepas: {y}% ({+/-d}%)" (green if not negative, else red), chip "{Subjek} (Umum)", "🎯 Ulang Latihan →". Section "Perlu Pemulihan Sekarang": one card per subject with pooled accuracy below 60% (V2: mean of session accuracy, FD-MUR-38): colour square, subject, badge "Perlu Pemulihan", "{n} soalan", "Ketepatan: {acc}%", "Sasaran: 60%", bar, "🎯 Latihan Pemulihan →". Empty with no sets: 🎉 "Tiada topik lemah!" / "Prestasi anda baik merentas semua subjek. Teruskan!" and button "Terus Berlatih →". Teacher-assigned remedial tests (V3 `remedial-tests/mine`, V2 Command Center) are listed too, with their own status.
- **Functional requirements**
  - FR-MUR-12-1 The page lists, in this order: completed sets, "Perlu Pemulihan Sekarang" cards, assigned tests; each with the exact V2 copy.
  - FR-MUR-12-2 A subject is "Perlu Pemulihan" when the pupil's pooled accuracy in it (correct ÷ answered in `practice_answers`, all modes, XS-5) is below 60% (target 60%); "{n} soalan" is the pupil's answers in that subject; "Ketepatan" is shown as a whole-number percent (FD-MUR-38); the card figures are the pupil's own and equal the Penguasaan Subjek and Analisa Item figures for that subject.
  - FR-MUR-12-3 "Latihan Pemulihan" opens a revision drill built from the pupil's wrong, still-servable questions of that subject (V2 Aku Salah drill; session mode `revision`); when the pupil has no still-servable wrong question, the drill uses the subject's weakest topics instead, and the V2 message "Tiada soalan salah untuk {Subjek} buat masa ini." is never shown while a card for that subject is listed (V2 contradiction, FD-MUR-36).
  - FR-MUR-12-4 "Sebelum" = pooled accuracy of the pupil's answers in that subject before the drill started; "Selepas" = the drill accuracy; difference shows sign and colour (whole-number percents).
  - FR-MUR-12-5 Empty state exact copy; "Terus Berlatih →" opens Latih Tubi.
  - FR-MUR-12-6 The drill follows 4.6 and the Latih Tubi engine; archived questions drop out.
- **Data and dependencies**: sessions and wrong answers (M05), assigned tests (M10/M11 teacher). Teacher feed: guru Command Center remedial generation.
- **Acceptance criteria**
  - AC-MUR-12-1 Given Sains at 0% over 120 questions, then a card "Perlu Pemulihan" shows "120 soalan", "Ketepatan: 0%", "Sasaran: 60%".
  - AC-MUR-12-2 Given the pupil completes the drill with 80%, then a set "Remedial Set 1 — Sains" shows "Selepas: 80%" with the difference.
  - AC-MUR-12-3 Given all subjects at least 60%, then "Tiada topik lemah!" shows.
  - AC-MUR-12-4 Given 375 px, then cards stack.
- **Current gap and root cause**: only `remedial-tests/mine`; no derivation from weak subjects (MURID gap 11).
- **Fidelity deviations**: FD-MUR-38 (pooled accuracy, whole-number percent). **Decisions applied**: none needed.

### R1-MUR-13 SPM (Bijak SPM / Simulasi, Databank, Tracking A, Subjektif, Kertas Subjektif)
- **Action**: Complete
- **Screen specification (from V2)**. Seven screens were observed.
  **S1. Hub `/spm`** (title "Mod SPM — PRESTASIPLUS"). Regions: (1) hero with badge "MOD SPM", heading "Persediaan SPM", text "Latihan lengkap untuk pelajar Tingkatan 4 & 5. Soalan tahun lepas, latih tubi, Tracking A, dan latihan bahasa berformat sebenar."; (2) four stat tiles "Jumlah Soalan", "Subjek SPM", "Tahun Tersedia", "Soalan Tracking A" (V2: 408,197 / 31 / 0 / 1,744; "Tahun Tersedia" is a constant 0, FD-MUR-18); (3) four cards, each title, one line, count chip and button "Mula": "Databank Soalan" ("Bank soalan SPM mengikut subjek, dipaparkan secara rawak.", "{n} soalan" opens S3), "Tracking A" ("Set objektif penuh dan lane bahasa khas untuk latihan intensif menjelang SPM.", "{n} soalan", opens S5), "Subjektif" ("Latihan soalan esei & jawapan panjang, disemak oleh guru.", "{n} set subjektif", opens S6; the copy "disemak oleh guru" is wrong, FD-MUR-19), "Bijak SPM" ("Duduki kertas SPM penuh dalam format kertas sebenar — bermasa, dengan skema.", "{n} set", opens S7); V2 does not show the cards "Latih Tubi SPM" and "Kertas Subjektif" (flagged off in V2); V3 shows them (D80, D104); (4) panel "Prestasi SPM Anda" with tiles "Sesi Kuiz", "Purata Ketepatan", "Syiling Diperoleh", "Soalan Dijawab" (observed 2, 0%, 0, 120; all 0 for a new pupil); (5) pill button "Sejarah Kuiz SPM" opens S2.
  **S2. Sejarah Kuiz SPM `/spm/history`**: link "Kembali ke Mod SPM"; heading "Sejarah Kuiz SPM"; tiles "Sesi Kuiz", "Purata Ketepatan", "Jumlah Syiling", "Soalan Dijawab"; filter chips "Semua", "Tahun Lepas", "Latih Tubi", "Tracking A"; list rows: percentage, mode name ("Tahun Lepas"), "{betul}/{n} betul", date and time (e.g. "23 Oct 2026, 08:06 PM"), duration (e.g. "· 37m 32s"), subject, coins "+{n} 🪙". Empty state (observed): 📝 "Belum ada percubaan SPM" / "Mula kuiz SPM untuk membina sejarah percubaan anda!" and button "Mula Kuiz SPM" (opens S3).
  **S3. Databank Soalan SPM `/spm/tahun-lepas`**: link "Kembali ke Mod SPM"; heading "Databank Soalan SPM"; sub "Pilih subjek dan mula jawab dari bank soalan". One card per subject (31 in V2): subject name, English name (e.g. "Malay Language"), "{n} soalan dalam databank", label "Pilih set:" with three buttons "5", "10", "20" (selects the quiz length) and button "Mula" (starts the quiz at `/spm/tahun-lepas/{kod}/kuiz?count={n}`).
  **S4. Databank quiz** (title "Kuiz {Subjek} — PRESTASIPLUS"): header with icon, subject, "Soalan {i} daripada {n}", running clock with label "Masa"; line "🔀 Soalan dan pilihan jawapan dirawak setiap sesi."; "❓ Soalan {i}" and chip "✓ Mengikut DSKP" (when tagged); question text; credit line "💬 Soalan oleh: {name}" (V2 prints the author's display name; V3 shows only a role label, privacy); options A to D, each with ✅ and ❌ marks that appear after checking; buttons "✓ Semak Jawapan" and then "Soalan Seterusnya →". Result: 💪 "Kuiz Selesai!" / "Tahniah, anda telah lengkapkan {Subjek}." tiles "{x}/{n}" "Markah" and "{p}%" "Ketepatan", "Masa: mm:ss", button "↻ Cuba Lagi" and the link "Senarai Subjek" (from the reference behaviour). The V2 sample question is plain text only (no figure): V2 differs, see 4.6 and D105.
  **S5. Tracking A `/spm/ramalan`**: link "Kembali ke Mod SPM"; heading "Tracking A SPM" with badge "TRACKING A" and line "Soalan Tracking A SPM — bersedia untuk apa yang mungkin keluar!"; two lane cards "Tracking A Objektif" ("Subjek objektif penuh", "Khusus untuk kertas objektif penuh yang boleh terus berjalan ikut set.", counts "{n} subjek", "{n} set", "{n} soalan") and "Tracking A Bahasa" ("BM dan BI format sebenar", "Lane khas untuk kertas bahasa tanpa memaksa format menjadi 40 MCQ.", "{n} subjek", "{n} set", "Paper-based tracking"); section "Tracking A Bahasa" ("BM dan BI ikut format kertas sebenar", "Subjek bahasa tidak dipaksa menjadi 40 MCQ. Ia dibuka melalui set berstruktur dan komponen sebenar peperiksaan.") with cards for Bahasa Melayu and Bahasa Inggeris ("{n} set", "Berstruktur / respons sebenar", button "Buka Tracking A Bahasa"); then one card per objective subject: name, English name, "{n} soalan kuiz siap guna", "{k} set bersih", "Target Latihan: 40", "{k} set", button "Pilih Set". Subject page (`/spm/ramalan/{kod}`, title "Tracking A SPM — {Subjek} — PRESTASIPLUS"): link "Kembali ke Tracking A SPM", subject name, chip "Set objektif · {k}", text "Set diramal daripada kertas SPM sebenar. Setiap set 40 soalan objektif dan ditanda automatik."; rows with "{tahun} · Set {n}", chip "Sedia dimain", title "Tracking A {tahun} — {Subjek} Set {n}", "40 soalan", button "Mula". Empty text: see D below (not in the capture).
  **S6. Subjektif `/spm/subjektif`**: link "Kembali ke Mod SPM"; heading "Latihan Subjektif SPM"; text "Pilih subjek untuk menjawab set struktur dan esei SPM berasaskan bank subjektif Tingkatan 4 dan 5."; box "Bagaimana ia berfungsi?" with "Pilih subjek → jawab set struktur/subjektif SPM → semak markah dan model jawapan." and "Bank ini ditarik daripada soalan berstruktur Tingkatan 4 dan 5 yang telah diterbitkan."; four tiles with a helper line each: "Set Dijawab" ("Percubaan subjektif SPM yang telah dihantar"), "Subjek Dicuba" ("Bilangan subjek subjektif SPM yang pernah dicuba"), "Skor Terbaik" ("Skor tertinggi merentas semua set subjektif SPM"), "Set Terbaik Disimpan" ("Bilangan set yang mempunyai percubaan terbaik tersimpan"); filter chips "Semua {n}", "Teras {n}", "Elektif {n}"; subject cards with badge "Teras" or "Elektif", English name and "{n} set subjektif". A card opens the Soalan Berstruktur list (R1-MUR-17).
  **S7. Bijak SPM / Simulasi list `/simulasi`** (title "Simulasi Peperiksaan — PRESTASIPLUS"): papers grouped by subject; group heading "{Subjek}" with "{n} set · {kod}"; each paper tile: title (e.g. "BAHASA INGGERIS Kertas 1 Set 1"), chips "Kertas {k}" (not on every tile in V2), "Tracking A" for composite papers, "{n} markah", button "Mula". Sitting `/simulasi/{id}` (title "{Subjek} — PRESTASIPLUS"): top bar with countdown clock (e.g. "00:06") and button "Hantar"; warning "Amaran: masa berbaki kurang 5 minit."; "SULIT", paper code, subject; "Bahagian A", "[40 markah]", "Jawab semua soalan."; each question: number, text (lists as bullet or roman-numeral lines), "[1 markah]", flag icon ⚑ (mark for review), "(a)" part label, options "A" to "D". V2 sample questions cite a table or map with none shown: V2 differs, see 4.6. Answering screen after Hantar, Semakan and self-mark were not captured (submit is forbidden on live V2): Not observed in V2 — follow FR-MUR-13-11 to FR-MUR-13-15 and section B below.
  - Loading and error: Not observed in V2 — follow FR-X6.
- **Corrections from the screens (earlier review)**: Corrections from the screens, applied in the Reference text below: hub shows four cards only (Databank Soalan "408,197 soalan", Tracking A "1,744 soalan", Subjektif "4,061 set subjektif", Bijak SPM "69 set") with "Latih Tubi SPM" and "Kertas Subjektif" absent (V2 flags); "Tahun Tersedia" shows 0; Databank is one page of subject cards each with "{n} soalan dalam databank", "Pilih set:" 5 / 10 / 20 and "Mula" (no separate setup page), button "✓ Semak Jawapan"; Tracking A is a two-lane page; Subjektif is a "Latihan Subjektif SPM" page; Simulasi lists papers grouped "{n} set · {code}". **V2 differs** (PRD follows D90/D105 and the schema): the Simulasi sample paper (Geografi, V2 route `/simulasi/:id`) has questions that cite "Jadual menunjukkan suhu bulanan..." and "Peta menunjukkan..." with no table or map shown, and the pupil sees answer letters only; the Databank sample question is plain text with an option list. The Bijak answering screen, Semakan and self-mark were not captured (submit is forbidden on live V2): see E-6.
- **Current gap and root cause (change list; reuse `SpmHubPage.vue`, `m28-bijak-spm` pages, `bijak/*` API)**: (1) content: UAT 0 contracts and 0 papers (admin pipeline); (2) add subjective self-mark, remaining answer widgets and stimulus kinds (`PartInput.vue`, `StimulusView.vue`, `be09-mapping.ts`); (3) 375 px gaps: "Hantar" missing from the bottom bar, mode badge missing, "Lapor Soalan" alone on a row, matrices as prose, navigator legend without colour keys; (4) hub: add the "Kertas Subjektif" card and page (D104), correct "Tahun Tersedia", correct the Subjektif card copy (FD-MUR-19); (5) Tracking A and Kertas Subjektif need admin writers (404 today); (6) Databank pool tag `spmPool:false` (`questions.service.ts:592`).
- **End-to-end flow**: see 46 sections 4.1 (hub), 4.2 (B1 Bijak sitting), 4.3 (B2 Kuiz), 4.4 (B3 Databank), 4.5 (B4 Tracking A), 4.6 (B5 Subjektif), 4.7 (B6 Kertas Subjektif), with 2.6 (autosave, resume, offline), 2.7 (timers), 2.8 (dialogs), 3 (marking) and 3.4 (self-mark). This block keeps the fields and the decisions of this module.
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Hub cards: Databank, Latih Tubi SPM, Tracking A, Subjektif, Kertas Subjektif, Bijak SPM banner | six links | - | - | all six always present and working (D104); zero-state per card: Databank `Tiada soalan tersedia lagi.`; Tracking A the exact text of the screen specification; Subjektif `Tiada soalan berstruktur ditemui`; Kertas Subjektif `Kertas subjektif sedang dalam penyediaan. Semak semula tidak lama lagi.` and the card shows "0 kertas"; Bijak `Tiada kertas tersedia buat masa ini` | - | - | - | hub read |
  | Sejarah Kuiz SPM chips Semua / Tahun Lepas / Latih Tubi / Tracking A | chips | - | Semua | modes `all`, `databank`, `latih_tubi`, `tracking_a` (the chip "Tahun Lepas" also counts old rows of mode `past_year`, and "Tracking A" old rows of `ramalan`: legacy read-only values, OPT-MODE-SESI); 15 per page, `completedAt` descending; pager "Sebelum" / "Seterusnya", `Halaman {p} daripada {n}`; the four tiles are over all modes, not the chip; Bijak sittings appear in "Semua" with their label | - | - | query `mod`, `halaman` | API-PRAC-03 |
  | Databank: Pilih set 5 / 10 / 20 | single select | Ya | 10 | OPT-BILANGAN-DB; a count above the available number is disabled | - | - | `count` | API-PRAC-01 mode `databank` (R1 never writes `past_year`) |
  | Databank grade | read-only | - | - | A+ >= 90, A >= 80, A- >= 70, B+ >= 65, B >= 60, C+ >= 55, C >= 50, D >= 40, else E, on the whole-number percent | - | - | - | - |
  | Tracking A: Pilih Set / Mula | buttons | - | - | sets by year descending then set number ascending; an incomplete set is not listed | - | - | mode `tracking_a` | API-PRAC-01 (objective), Bijak attempt (Bahasa) |
  | Subjektif / Databank subject filter chips Semua / Teras / Elektif | chips | - | Semua | `all`, `core`, `elective` with subject counts | - | - | query | - |
  | Bijak: Subjek filter | select | Tidak | "Semua subjek" | subjects of Terbit papers, name asc | - | - | query `subjek` | `GET /api/bijak/papers` |
  | Bijak: Kertas filter | select | Tidak | "Semua kertas" | OPT-KERTAS (distinct `kertas` of the visible papers, "Kertas {k}", ascending) | - | - | query `kertas` | same |
  | Tab "Kertas Pilihan" | tab | - | Kertas Pilihan | the only tab; there is no "Jana Kertas" tab and the pupil generate route answers 404 (D112(6)) | - | - | - | API-BIJAK-03 (pupil: 404 in R1) |
  | Mod: Mod Peperiksaan / Mod Latihan | radio cards on the cover | Ya | Mod Peperiksaan (`exam`) | `exam` timed; `latihan` untimed with per-question "Semak" (max 3 answer-changing checks per question, then `Had semakan untuk soalan ini telah dicapai.`); "Mula" starts with the selected mode; resume keeps the attempt's mode | - | - | attempt `mode` | API-BIJAK-04 |
  | Simulasi — Kuiz count | URL parameter `count` (no picker on the Kuiz page, D83; 46 section 4.3) | Ya | 20 | OPT-BILANGAN-KUIZ: 5, 10, 20, 40; any other value falls back to 20 | - | - | `count` | API-BIJAK-06 `POST /api/bijak/kuiz/sessions` (random Kuiz; the rows of mode `kuiz` are written by `.../finish`; API-PRAC-01 is not used for Kuiz) |
  | Pilih soalan ini untuk dijawab (choose-N) | checkbox per question, counter `{n} / {N} soalan dipilih` | - | unticked | the (N+1)th tick is refused with `Anda hanya boleh memilih {N} soalan dalam bahagian ini.`; picks persist | - | section rule | `picks[sectionId]` | API-BIJAK-04 |
  | Tanda soalan (flag) | toggle | - | off | - | - | - | `flags[]` | same |
  | Answer controls (all leaf kinds) | see 46 section 2.2 and the field table of 4.6 | - | - | OPT-MOD-JAWAPAN | per 46 section 3.2 | - | one `practice_answers` row per leaf part | API-BIJAK-04 |
  | Foto jalan kerja | file / camera | Tidak | none | JPG or PNG, 5 MB, 3 per part, only `working` and `drawing` parts; remove with dialog B-056e (title `Buang gambar ini?`, body `Gambar ini akan dibuang daripada jawapan anda.`, buttons "Buang" / "Batal") | `Gambar mesti JPG atau PNG, maksimum 5 MB.` / `Maksimum 3 gambar bagi setiap bahagian.` | - | photo file | API-BIJAK-04 |
  | Hantar / Hantar Jawapan | button; at 375 px always in the bottom bar | - | - | dialog B-052: `Hantar jawapan anda sekarang?`, with blanks first line `Anda belum menjawab {n} soalan.`, buttons "Hantar" / "Batal" | double press = one submission (idempotency key `{attemptId}-hantar`) | - | - | API-BIJAK-04 |
  | Mula Semula / Sambung / Cuba Lagi | buttons | - | - | resume page `Percubaan belum dihantar`, `Masa berlalu setakat ini: mm:ss`; "Mula Semula" dialog B-053: `Semua jawapan dan masa untuk percubaan ini akan dikosongkan. Mula semula?` plus note `"Sambung" mengekalkan semua jawapan anda. "Mula Semula" tidak boleh diundur.`, buttons "Mula Semula" / "Batal"; "Cuba Lagi" only from a closed attempt (else `Hantar percubaan ini dahulu sebelum mencuba semula.`; paper gone `Kertas ini sudah tidak tersedia untuk dicuba semula.`; archived question ERR-BIJ-04) | - | - | - | API-BIJAK-04 |
  | Leave the sitting | dialog B-051 | - | - | title `Keluar daripada percubaan?`, body `Jawapan anda disimpan dan masa terus berjalan.` (exam) or `Jawapan anda disimpan.` (latihan), buttons "Keluar" / "Kekal" | - | - | - | - |
  | Hantar & Semak with blanks (Subjektif / Kertas Subjektif) | dialog B-056d | - | - | only when a leaf is blank: title `Hantar & Semak sekarang?`, body `Anda belum menjawab {n} bahagian.`, buttons "Hantar & Semak" / "Kembali" | - | - | - | - |
  | Tunjuk Skema Pemarkahan / Sembunyi | toggle button, enabled after "Hantar & Semak" | - | hidden | the scheme is fetched only on press; failure `Skema pemarkahan tidak tersedia untuk kertas ini.` | before submit: 409 NOT_SUBMITTED `Skema hanya didedahkan selepas Hantar` | closed attempt | - | API-BIJAK-04 (`GET /api/bijak/attempts/:id/result?scheme=1`) |
  | Markah dinilai sendiri / Markah kendiri | stepper (number) | - | blank until marked | integer 0..part marks, step 1; "-" and "+" buttons >= 44 px and a numeric input; a non-integer rounds half up, a negative becomes 0; over the maximum the stored value is the maximum; a band picker sets the mark to the band midpoint (round half up); saved 500 ms after the last change with the state "menyimpan…" / "disimpan"; a part with no budget: `Markah maksimum Bahagian ini belum ditetapkan - hubungi pentadbir.` | auto-marked part: `Bahagian ini ditanda automatik; markah kendiri tidak diperlukan.`; wrong band: `Band tidak sah untuk bahagian ini.` | closed attempt | the `practice_answers` row of the part is replaced | API-BIJAK-05 |
  - Behaviour (decided): (1) Autosave is a 800 ms debounce plus a flush on blur, on question change and every 15 s while dirty; each part carries `rev` (+1 per edit) and the higher `rev` wins; the top bar shows "menyimpan…", "disimpan", "luar talian", "gagal simpan" with a fixed 5 s retry (D-PA-16, ERR-SAVE-01). (2) The timer: `deadline` and `serverNow` come from the view; remaining = deadline - (Date.now() + offset), recomputed every second; at 300 s once the amber line `Amaran: masa berbaki kurang 5 minit.`; at 0 an automatic submit with `auto:true` and the banner `Masa tamat. Jawapan anda telah dihantar secara automatik.`; offline at 0 the inputs lock and the banner reads `Masa tamat. Jawapan akan dihantar apabila sambungan pulih.`; the server accepts changes with `savedAt` before the deadline for 24 h and a manual late submit is never rejected. (3) Attempt states: `in_progress` ("Belum dihantar"), `submitted` ("Dihantar"), `auto_submitted` ("Dihantar automatik"), `abandoned` ("Ditinggalkan"). (4) A duplicated stem is shown once and NOT excluded (D113). (5) drawing, table_fill and essay_choice are served (see 4.6 item 3 and 46 section 2.2). (6) Mod Latihan pays only parts never opened with "Semak" (D-PA-13). (7) Percent is shown as a whole number (K9); `percent` may be stored with one decimal. (8) Session expiry during a timed attempt: ERR-AUTH-01 dialog, answers stay on the device. (9) Errors: ERR-BIJ-01..06, ERR-SAVE-01..07, ERR-NET-*.
  - New requirements: FR-MUR-13-31 The sitting at 375 px shows "Hantar" and the badge "Mod Peperiksaan" or "Mod Latihan" in the same bar as the timer and the navigator button (verified live gap). FR-MUR-13-32 Autosave uses a 800 ms debounce (FR-MUR-13-10 restated as a testable value). FR-MUR-13-33 A duplicated stem is shown once and never excluded (D113). FR-MUR-13-34 The hub card "Kertas Subjektif" exists for every T1-T5 pupil (verified real gap): it shows "{n} kertas" and opens `/kertas-subjektif`. FR-MUR-13-35 A swept (abandoned) Kuiz writes rows for its checked questions with no reward (D-PA-15); a swept drill session is `ditinggalkan` with no reward (D-PA-8). FR-MUR-13-36 Tracking A objective uses the drill engine with rows of mode `tracking_a`; Tracking A Bahasa uses the Subjektif sitting engine with rows `tracking_a` (D-PA-12).
  - New acceptance criteria: AC-MUR-13-27 Given a 375x667 viewport and an open sitting, then "Hantar" and "Mod Peperiksaan" are visible without scrolling. AC-MUR-13-28 Given the pupil types one character, then `PUT /api/bijak/attempts/{id}/answers` is sent 800 ms (±100 ms) after the last keystroke and "disimpan" shows within 2 s of the response. AC-MUR-13-29 Given a T3 pupil, then the SPM hub shows the six cards including "Kertas Subjektif" with "{n} kertas". AC-MUR-13-30 Given two Bijak questions with the same stem text, then both are served, each once, and neither is flagged as excluded. AC-MUR-13-31 Given a Mod Latihan sitting where the pupil opened "Semak" on 2 of 10 parts, then the reward is paid for the other 8 parts only. AC-MUR-13-32 Given the clock reaches 0 offline, then the inputs lock, the banner `Masa tamat. Jawapan akan dihantar apabila sambungan pulih.` shows and the submit happens once on reconnect.
- **Name**: "SPM" (page "Mod SPM", sub "Persediaan SPM anda", heading "Persediaan SPM"). Bijak SPM entry: "Bijak SPM".
- **Route**: `/spm` (hub); `/spm/bijak`, `/spm/bijak/kertas/:paperId`, `/spm/bijak/percubaan/:attemptId`, `/spm/bijak/percubaan/:attemptId/keputusan`, `/spm/bijak/sejarah`, `/simulasi/kuiz`; `/spm/tahun-lepas`; `/spm/ramalan`; `/spm/subjektif` then `/latihan-berstruktur`; `/kertas-subjektif`, `/kertas-subjektif/:paperId`. **Matrix row**: 13. **Priority**: P0.
- **Current status**: GitHub hub works with demo counts (Databank 492, Tracking A 370, Subjektif 3); Bijak 1-2 papers; UAT: Bijak "Tiada kertas tersedia buat masa ini" (0 contracts, 0 papers), Databank 24,163, Tracking A 0, Subjektif 0, "Tahun Tersedia 0". V2 production: Databank 408,197, Tracking A 1,744, Subjektif 4,061 sets, Bijak 69 papers. Missing: subjective self-mark in GH was added later (R1-B12); `table_fill`, `drawing`, `match_letter`, many stimulus kinds in the UI (parity B07/B08); Tracking A and Subjektif have no admin writer.
- **Outcome**: sit full SPM-style papers like the real exam, drill past-year and prediction sets, and practise subjective questions with self-marking.
- **Reference behaviour**
  **A. Hub (V2 `pelajar/spm.blade.php`)**: badge "MOD SPM", heading "Persediaan SPM", text "Latihan lengkap untuk pelajar Tingkatan 4 & 5. Soalan tahun lepas, latih tubi, Tracking A, dan latihan bahasa berformat sebenar."; stat tiles "Jumlah Soalan", "Subjek SPM", "Tahun Tersedia", "Soalan Tracking A"; banner "Bijak SPM" / "Duduki kertas SPM penuh dalam format kertas sebenar — bermasa, dengan skema." button "Buka"; cards (V2 live shows only the four cards Databank Soalan, Tracking A, Subjektif and Bijak SPM, each with a count chip and "Mula"; "Latih Tubi SPM" and "Kertas Subjektif" are V2-flag cards that the PRD shows, D80/D104). The Sejarah page: link "Kembali ke Mod SPM", heading "Sejarah Kuiz SPM", tiles "Sesi Kuiz", "Purata Ketepatan", "Jumlah Syiling", "Soalan Dijawab", filter chips "Semua", "Tahun Lepas", "Latih Tubi", "Tracking A", rows "{x}%", mode, "{betul}/{n} betul", date "23 Oct 2026, 08:06 PM", " · 37m 32s", subject, "+{n} 🪙". Simulasi list (`/simulasi`): subject group heading "{Subjek}" and "{n} set · {code}", tile "{TAJUK} Kertas {k} Set {n}", chips "Kertas {k}" and "{n} markah", a "Tracking A" chip for composites, button "Mula"; sitting (`/simulasi/:id`): top bar with the timer and "Hantar", the warning "Amaran: masa berbaki kurang 5 minit." under it, "SULIT", paper code, subject, "Bahagian A", "[40 markah]", "Jawab semua soalan.", numbered questions with "(a)", options, "[1 markah]" and a flag; cards: "Databank Soalan" ("Bank soalan SPM mengikut subjek, dipaparkan secara rawak.", "{n} soalan"), "Latih Tubi SPM" ("Latihan ikut topik dan bab untuk Tingkatan 4 & 5.", "{n} soalan"), "Tracking A" ("Set objektif penuh dan lane bahasa khas untuk latihan intensif menjelang SPM.", "{n} soalan"), "Subjektif" (V2 text "Latihan soalan esei & jawapan panjang, disemak oleh guru." is wrong: R1 shows "Latihan soalan berstruktur & esei, semak sendiri dengan skema.", FD-MUR-19; "{n} set subjektif"); panel "Prestasi SPM Anda" tiles "Sesi Kuiz", "Purata Ketepatan", "Syiling Diperoleh", "Soalan Dijawab"; pill button "Sejarah Kuiz SPM". A card "Kertas Subjektif" ("Kertas 2, 3 & 4 percubaan negeri — baca, jawab, buka skema untuk semak sendiri.", "{n} kertas") is shown (V2 teal card, route `/kertas-subjektif`; D104: fully working, no flag, content per D81). "Tahun Tersedia" is a constant 0 in V2 (FD-MUR-18). Subjektif copy "disemak oleh guru" is wrong (marking is self-mark, FD-MUR-19).
  **B. Bijak SPM (V2 `/simulasi`, V3 `/spm/bijak`)**: V3 page: back "Mod SPM", text "Duduki kertas SPM penuh dalam format kertas sebenar — bermasa, dengan skema.", buttons "Simulasi — Kuiz", "Sejarah Bijak SPM", tab "Kertas Pilihan" (the V3 tab "Jana Kertas" is hidden, D112(6), FR-MUR-13-20). Kertas Pilihan: filters "Subjek" ("Semua subjek"), "Kertas" ("Semua kertas"); papers published (Terbit) only, grouped by subject; tile "Set {n}" or title, chips "Kertas {k}", "{marks} markah", "{duration} min", "Mula" or "Sambung"; empty "Tiada kertas tersedia buat masa ini" / "Set simulasi sedang dalam penyediaan. Semak semula tidak lama lagi.". Cover: "SULIT", paper code, subject, "Kertas {k}", "{n} minit", numbered instructions, reference sheets; modes "Mod Peperiksaan" / "Mod Latihan" (V3 addition). Resume page: "Percubaan belum dihantar", "Masa berlalu setakat ini: mm:ss", "Sambung — teruskan jawapan & masa sedia ada", "Mula Semula — kosongkan jawapan & masa" (confirm "Semua jawapan dan masa untuk percubaan ini akan dikosongkan. Mula semula?"), note "“Sambung” mengekalkan semua jawapan anda. “Mula Semula” tidak boleh diundur.". Timer: counts down for timed papers (warning at 5 minutes: "Amaran: masa berbaki kurang 5 minit."; auto-submit at 0), counts up for untimed ("Masa berlalu"); save states "menyimpan…", "disimpan", "gagal simpan", "luar talian"; "Hantar" confirm "Hantar jawapan anda sekarang?"; late submit never rejected. Bahagian header with label, "[{n} markah]", rule line "Jawab semua soalan." / "Jawab {N} soalan sahaja." and counter "{n} / {N} soalan dipilih" for choose-N, checkbox "Pilih soalan ini untuk dijawab". Question map with legend "Dijawab", "Ditanda", "Belum", flag "Tanda soalan". Result ("Semakan"): status "Dihantar", "{score} / {max}", per part verdicts, "Skema Pemarkahan · {n} markah", "Markah kendiri:", button "Cuba Lagi", link "Lihat semakan lepas". Sejarah Bijak SPM = list of past sittings. "Simulasi — Kuiz": random objective quiz (5/10/20/40, default 20), header "Simulasi — Kuiz", "Soalan {i} daripada {n}", "✓ Semak" (server check), "🎉 Betul!" / "😟 Salah", "Soalan Seterusnya →" / "Tamat →", end "Kuiz Selesai!" with Markah, Ketepatan, Masa, buttons "↻ Cuba Lagi", "Kertas penuh"; empty "Belum ada soalan objektif".
  **C. Databank Soalan SPM (V2 `/spm/tahun-lepas`; screens confirm)**: page "Databank Soalan SPM" with link "Kembali ke Mod SPM" and sub "Pilih subjek dan mula jawab dari bank soalan"; one card per subject: name, English name, "{n} soalan dalam databank", "Pilih set:" with three buttons 5, 10, 20 and "Mula" (the count is chosen on the card; there is no separate setup page); quiz header with the subject, "Soalan {i} daripada {n}", timer "Masa", "🔀 Soalan dan pilihan jawapan dirawak setiap sesi.", chip "✓ Mengikut DSKP" when tagged, "❓ Soalan {i}", options A-D with ✅/❌ marks, "💬 Soalan oleh: {name}" when credited, button "✓ Semak Jawapan", then "Soalan Seterusnya →"; result "Kuiz Selesai!" / "Tahniah, anda telah lengkapkan {subjek}." with "Markah", "Ketepatan", "Masa: mm:ss", "↻ Cuba Lagi", "Senarai Subjek"; one question per screen, then "Penjelasan:" when present, result with grade (A+ 90, A 80, A- 70, B+ 65, B 60, C+ 55, C 50, D 40, else E) and "Ganjaran Anda"; session mode `spm_tahun_lepas` in V2; V3 R1 writes `databank` (50 section 4.7a). Most used V2 activity (426 sessions).
  **D. Tracking A (V2 `/spm/ramalan`; screens confirm and replace the earlier text)**: page "Tracking A SPM" (badge "TRACKING A", "Soalan Tracking A SPM — bersedia untuk apa yang mungkin keluar!"); two lane cards: "Tracking A Objektif" ("Subjek objektif penuh", "Khusus untuk kertas objektif penuh yang boleh terus berjalan ikut set.", "14 subjek", "78 set", "3,120 soalan") and "Tracking A Bahasa" ("BM dan BI format sebenar", "Lane khas untuk kertas bahasa tanpa memaksa format menjadi 40 MCQ.", "2 subjek", "1,332 set", "Paper-based tracking"); section "Tracking A Bahasa" with BM ("559 set", "Berstruktur / respons sebenar", "Buka Tracking A Bahasa") and BI ("773 set"); subject cards such as Sains "80 soalan kuiz siap guna", "2 set bersih", "Target Latihan: 40", "2 set", "Pilih Set"; subject page "Tracking A SPM — Sains" with "Set objektif · 2", "Set diramal daripada kertas SPM sebenar. Setiap set 40 soalan objektif dan ditanda automatik.", rows "2026 · Set 1", "Sedia dimain", "Tracking A 2026 — Sains Set 1", "40 soalan", "Mula". The empty text "Tiada set objektif Tracking A yang bersedia lagi. Set sedang dibina — semua set semasa masih dalam proses pengisian. Semak semula tidak lama lagi!" comes from the V2 view (not in the screens). A set has a fixed question list (default 40) built by the admin; options shuffled; V2 mode `spm_ramalan`, V3 R1 writes `tracking_a`. BM and BI use the Bahasa lane (structured).
  **F. Kertas Subjektif (V2 `/kertas-subjektif`, D81, D104)**: index heading "Kertas Subjektif", sub "Kertas 2, 3 & 4 percubaan negeri — baca soalan, jawab atas kertas, kemudian buka skema untuk semak sendiri"; papers ordered by kertas then negeri, grouped by subject (groups by size); empty "Kertas subjektif sedang dalam penyediaan. Semak semula tidak lama lagi."; viewer heading "{subject} — Kertas {k}", "{marks_total} markah", the paper as reflowing text (D81: uploaded, OCR, edited, published by the admin; not page images), button "Tunjuk Skema Pemarkahan" / "Sembunyi", fallback "Skema pemarkahan tidak tersedia untuk kertas ini."; self-mark per question or per Bahagian "Markah dinilai sendiri (Bahagian {x}):" with a stepper from 0 to its marks and the total, recorded as a session; V2 note when the budget is missing: "Markah maksimum Bahagian ini belum ditetapkan — hubungi pentadbir.".
  **E. Subjektif (V2 `/spm/subjektif`; screens replace the earlier heading)**: page "Latihan Subjektif SPM" with "Kembali ke Mod SPM", "Pilih subjek untuk menjawab set struktur dan esei SPM berasaskan bank subjektif Tingkatan 4 dan 5.", box "Bagaimana ia berfungsi?" ("Pilih subjek → jawab set struktur/subjektif SPM → semak markah dan model jawapan." / "Bank ini ditarik daripada soalan berstruktur Tingkatan 4 dan 5 yang telah diterbitkan."), tiles "Set Dijawab", "Subjek Dicuba", "Skor Terbaik", "Set Terbaik Disimpan" each with an explanatory line, filter chips "Semua {n}", "Teras {n}", "Elektif {n}", subject cards with a "Teras" or "Elektif" badge, English name and "{n} set subjektif" (BM 559, BI 773, Perniagaan 301 in the sample); answer screen "Soalan Berstruktur — Jawab" (per 4.6; V2 text "✍️ Tulis jawapan anda, kemudian tekan Hantar & Semak.", button "Hantar & Semak", scheme "Skema Pemarkahan:"), result `/latihan-berstruktur/keputusan/:attempt`; empty "Tiada soalan berstruktur ditemui".
- **Functional requirements** (the question display and answering contract of 4.6 applies to every item below)
  - FR-MUR-13-1 The hub shows the exact title, text, stat tiles and cards of A, with every count computed per D91 (card = details = drawable) and the six cards Databank, Latih Tubi SPM, Tracking A, Subjektif, Kertas Subjektif and the Bijak SPM banner all present and working (D104; no flag switches Subjektif or Kertas Subjektif off); a card with zero content shows its data-empty text, never a dead link.
  - FR-MUR-13-2 "Prestasi SPM Anda" shows the pupil's own SPM-mode sessions (Databank, Tracking A, Subjektif, Bijak) and "Sejarah Kuiz SPM" lists them; "Sesi Kuiz", "Purata Ketepatan" (pooled, whole-number percent) and "Soalan Dijawab" are read from the single answer store `practice_answers` (FR-MUR-13-21).
  - FR-MUR-13-3 "Tahun Tersedia" is the number of distinct exam years among servable papers/questions and is hidden when year data is absent.
  - FR-MUR-13-4 Bijak lists only papers with status Terbit (D79/D85 "papers need Terbit"); draft, in review and archived papers are not listed and their URL returns not-found.
  - FR-MUR-13-5 Papers are grouped by subject (groups ordered by paper count desc), filters Subjek and Kertas work, cards show the three chips.
  - FR-MUR-13-6 The cover and resume page use the exact copy in B; "Mod Peperiksaan" is timed and shows the clock, "Mod Latihan" is untimed with per-question "Semak" (V3 addition kept, FD-MUR-20).
  - FR-MUR-13-7 The attempt is one question or one stimulus group per screen with the question map; V2's printed-sheet pagination ("Halaman X daripada Y", "← Sebelum", "Seterusnya →") is not used; navigation keeps the V2 labels "Sebelum" / "Seterusnya" and on the last screen "Hantar Jawapan" (FD-MUR-21).
  - FR-MUR-13-8 Section rules: "Jawab semua" and "Pilih N" (choose N of M) are enforced; an (N+1)th pick is refused with a plain BM message; the server scores the best N by marks (tie lower position).
  - FR-MUR-13-9 A shared stimulus group is shown once with all member questions (D90); a member is never offered alone in a paper; below 1024 px a collapsible sticky panel with the header "Lihat {label}" (FR-MUR-QP-2) opens the stimulus, from 1024 px the stimulus is pinned beside the questions.
  - FR-MUR-13-10 Autosave: 800 ms debounce to the server plus local mirror, `sendBeacon` on leave; hidden questions keep answers; the attempt restores on reload and on another device.
  - FR-MUR-13-11 Hantar confirms, submits once (idempotent), marks objective parts on the server, and shows Semakan; a submit is never rejected for lateness: at 00:00 the client auto-submits; a submit or offline sync arriving after expiry is accepted (late sync up to 24 h, FR-MUR-13-32) and stored with its real `submittedAt`; the 30 s figure is only the client grace before auto-submit.
  - FR-MUR-13-12 Semakan reveals the scheme only after submit: correct option, accepted values, mapping, marking points with hit or miss, model answer or band rubric (4.6.5); per-part "✓ Betul ({a}/{m})" or "✗ Salah ({a}/{m})".
  - FR-MUR-13-13 Self-mark: for parts that are not auto-marked the pupil sets "Markah kendiri:" from 0 to the part marks (server clamps, owner only, after submit, not locked); a band rubric shows a band picker that sets the stepper to the band midpoint; a Bahagian marked as a whole shows one stepper; the total "{score} / {max}" refreshes at once.
  - FR-MUR-13-14 Rewards (D97, D94; rates per 4.4): every submitted attempt earns the Syiling rate and 10 XP per mark, where the Syiling rate is the admin setting "Syiling flat / soalan betul" (default 1, never a constant in code); a later self-mark earns the same rate + 10 XP per mark gained (positive change only, once per part, never above full marks, nothing is taken back); "Cuba Lagi" attempts earn again; resubmit never double-awards. A Mod Latihan sitting pays only the parts that were never opened with "Semak" (D-PA-13): no reward is lost, and nobody can farm a reward by reading the answer.
  - FR-MUR-13-15 "Cuba Lagi" creates a new blank attempt of the same paper (refused with "Kertas ini sedang dikemas kini dan tidak boleh dicuba buat masa ini." when the paper contains an archived question); "Lihat semakan lepas" opens the latest submitted result.
  - FR-MUR-13-16 "Simulasi — Kuiz": random approved objective parts with a correct option, count 5/10/20/40; "✓ Semak" checks on the server, the key is not in the page before it, and it does not consume trial checks (D97). The random Kuiz uses the Bijak endpoints of API-BIJAK-06 only (`POST /api/bijak/kuiz/sessions` to start, `.../check` for "Semak", `.../finish` to end) and never API-PRAC-01 (D-T10-3). A Kuiz "Semak" check writes no `practice_answers` row; only the final submit/finish of the kuiz session (`POST /api/bijak/kuiz/sessions/:id/finish`) writes one row per checked question, mode `kuiz` (50 section 4.7a), idempotent per session and question. Per-paper Kuiz may show key and explanation even with an open sitting (D97).
  - FR-MUR-13-17 Databank follows C: counts 5/10/20, random, MCQ questions including figure questions and whole stimulus groups (D105; a group is drawn whole or not at all), "Penjelasan:" when present, grade and "Ganjaran Anda"; every admin-approved MCQ of T1-T5 with a subject becomes eligible with no pool flag (R1-11.2).
  - FR-MUR-13-18 Tracking A follows D including the exact empty text; its content comes from the admin Tracking A set editor (cross-ref R1-ADM Tracking A); the pupil sees only sets that are complete (not "locked").
  - FR-MUR-13-19 Subjektif follows E; answer, marking suggestion and self-mark use 4.6; the card shows "{n} set subjektif" computed per D91; its copy is corrected (FD-MUR-19). The lane is stored as an exam attempt (D-A9): starting a structured set (`POST /api/practice/structured/:id/attempts`, API-PRAC-10, card S5-T11) creates an `exam_attempts` row with `paper_kind = 'structured'` (`paper_id` null, `composition` = the frozen question list, `title` = the set title, `mode = 'latihan'`, untimed; migration `0186_s3_exam_attempt_paper_kind`, DM-83) with answer rows of `mode = structured`; a Kertas Subjektif sitting (FR-MUR-13-26..30, card S3-T06, started through API-BIJAK-04) has `paper_kind = 'subjektif'` and `paper_id` set (also `mode = 'latihan'`), with rows of `mode = subjektif`. Scheme reveal and self-mark of both kinds use the existing `POST /api/bijak/attempts/:id/self-mark` (API-BIJAK-05) (clamp, owner only, delta-only reward; FR-MUR-13-13); the self-marked result is written to the answer store per FR-MUR-13-21 and the attempt shows in Prestasi "Sesi" and in "Sejarah Kuiz SPM".
  - FR-MUR-13-20 (D112(6), D88; the requirement text of the earlier draft is deleted) The pupil "Jana Kertas" tab is OUT of R1 (V2 pupils have no such function): the tab is hidden on `/spm/bijak`, and the pupil route and any link to it return 404 (FR-X2-2). No pupil path generates a paper; papers are only the ones the admin publishes (Kertas Pilihan). The admin Jana Kertas (FR-ADM-QE7.2) stays, and the servability value `jana_kertas` stays for admin generation.
  - FR-MUR-13-21 Every SPM activity writes its answers to the single answer store `practice_answers` (owner practice, M05) with a mode value, once per attempt (idempotent on resubmit): Databank (`databank`), Tracking A objective and Bahasa (`tracking_a`), Kuiz (`kuiz`), Simulasi and Bijak sittings (`simulasi`), Soalan Berstruktur (`structured`) and Kertas Subjektif (`subjektif`); the stored `mode` of every pupil activity is the master table "Pupil activity → stored `mode` → API → card" next to OPT-MODE-SESI in 40 (X11), which this file does not restate or contradict. An auto-marked part writes correct or wrong; a self-marked part writes the marks awarded and the marks available, and updates when the pupil changes the self-mark (the later value replaces the earlier, never a second row). These rows are the only source of Prestasi, Dashboard, Analisa Item, Heatmap, Remedial, the teacher, school-admin and Admin Pusat reports, Kirkpatrick, Command Center and Headcount AR (where HC-3 lists the mode); no screen reads a separate Bijak aggregate for these figures (40-cross-cutting FR-X4-5, X4a).
  - FR-MUR-13-22 A T1-T3 pupil sees the hub, Databank, Latih Tubi SPM and Bijak with the content that exists for T1-T5 (D101, R1-19.1); hub copy "Tingkatan 4 & 5" stays because SPM is a Form 5 exam.
  - FR-MUR-13-23 The sitting bar shows "Hantar" at every width including 375 px (live UAT gap: missing at 375), together with the timer and the navigator button; the mode badge ("Mod Peperiksaan" or "Mod Latihan") is visible at every width.
  - FR-MUR-13-24 Mathematical content (matrices, fractions, powers, roots, units) renders as notation, never as a prose description such as "matriks (5 1; 2 3), iaitu baris pertama 5, 1 dan baris kedua 2, 3"; a question stored as prose is flagged to the admin as needing a maths rewrite and is not a pupil-side rewrite.
  - FR-MUR-13-25 The navigator legend "Dijawab · Ditanda · Belum" shows a colour key and a shape or icon per state so it is not colour-only, at every width.
  - FR-MUR-13-26 Kertas Subjektif lists only published papers (D81 flow, Terbit) with the exact index copy of F, and the card count "{n} kertas" equals the list.
  - FR-MUR-13-27 The Kertas Subjektif viewer shows the paper as reflowing text with stimuli per 4.6 (figure once, group whole), at 375/768/1280 px without sideways scroll; the pupil answers on paper or types, as the question mode allows.
  - FR-MUR-13-28 "Tunjuk Skema Pemarkahan" reveals the scheme and "Sembunyi" hides it; before it is pressed the scheme is not in the page. A paper without a scheme cannot be published (FR-ADM-Q18.8), so the pupil never meets a paper without a scheme; the V2 fallback text "Skema pemarkahan tidak tersedia untuk kertas ini." is shown only as a defensive state if the scheme fails to load. The button is enabled only after "Hantar & Semak" (D-PA-14); before that the scheme is not fetched.
  - FR-MUR-13-29 Self-mark: the pupil sets "Markah dinilai sendiri" from 0 to the question or Bahagian marks (server clamps, owner only); the total updates at once, is saved, and a session is recorded once per paper attempt with its answers written per FR-MUR-13-21 (a Kertas Subjektif self-mark is the same stored Bijak attempt flow as FR-MUR-13-19); rewards per FR-MUR-13-14. Self-mark is available only after "Hantar & Semak" (D-PA-14, API-BIJAK-05: 409 NOT_SUBMITTED before).
  - FR-MUR-13-30 No feature flag, config or admin toggle hides Subjektif or Kertas Subjektif (D104); the admin Kertas Subjektif screens feed it (cross-ref R1-ADM).
- **Data and dependencies**: papers, contracts, stimuli, attempts (Bijak/exam core, owner M06/M28 exam model; D12 questions owner M04). Admin feeds (cross-ref R1-ADM): Studio, Import and Semakan, Set Builder / Pembina Kertas (Terbit), Kontrak Simulasi (Disahkan), Tracking A editor (missing, 404 today), Kertas Subjektif upload, OCR, edit and publish (D81; admin 404 today), Latih Tubi lane. API: `bijak/*` (papers, attempts, answers, submit, self-mark, retry, result, history, kuiz), `spm/overview`, `spm/databank`, `spm/tracking-a`, `spm/subjektif`, `practice/structured`.
- **Acceptance criteria**
  - AC-MUR-13-1 Given a T5 pupil on UAT with at least one Terbit paper, when `/spm/bijak` opens, then the paper shows under its subject with the chips; with none, the exact empty text shows.
  - AC-MUR-13-2 Given a draft paper id, when the pupil opens its URL, then not-found.
  - AC-MUR-13-3 Given "Pilih 3" of 5 questions, when the pupil ticks a 4th, then a BM message refuses it and the 3 picks persist after reload; scoring counts the 3 best.
  - AC-MUR-13-4 Given a stimulus group "Rajah 1" with Q5-Q6, then Rajah 1 appears once with both questions; at 375 px a chip "Lihat Rajah 1" opens it; at 1280 px it is pinned.
  - AC-MUR-13-5 Given typing, then within 2 s "disimpan" shows; offline shows "luar talian" and answers reach the server when online; reload restores answers.
  - AC-MUR-13-6 Given Hantar pressed twice, then one submission and the same score.
  - AC-MUR-13-7 Given a submitted attempt with a 4-mark working part marked 2 by suggestion, when the pupil sets 3, then the part, Bahagian total and "{score} / {max}" update and the wallet gains {Syiling rate} Syiling (default 1) + 10 XP for that 1 mark; a later change to 1 takes nothing back.
  - AC-MUR-13-8 Given "Cuba Lagi", then a new attempt opens and the old attempt stays in "Sejarah Bijak SPM".
  - AC-MUR-13-9 Given a Databank subject whose test bank has 30 servable MCQs including one stimulus group of 3, when the pupil starts a 10-question Databank session, then 10 questions are served, each "✓ Semak" returns the server result, any group in the draw appears with all 3 members and its figure once, and the card count shown before the session is 30 (D91, D105).
  - AC-MUR-13-10 Given an admin approves an MCQ for Sejarah T5, then the Databank Sejarah count rises by 1 on next load.
  - AC-MUR-13-11 Given a Tracking A set not yet complete, then it is not listed; with none, the exact empty text shows.
  - AC-MUR-13-12 Given a Subjektif structured question, then the pupil answers each part per 4.6, presses "Hantar & Semak", sees the scheme only after that, and self-marks.
  - AC-MUR-13-13 Given any environment and a pupil of form F, when the hub loads, then the tile "Jumlah Soalan" equals the sum of the per-subject Databank counts returned by the API for the pupil's form, the tile "Soalan Tracking A" equals the Tracking A count returned by the API, each card chip equals the count in its own surface details view (D91), and no Darjah question is counted; no figure is hard-coded in the test or in the page.
  - AC-MUR-13-14 Given 375, 768 and 1280 px, then hub, Kertas Pilihan, attempt, question map and Semakan have no horizontal page scroll and every option and stepper is tappable (at least 44 px).
  - AC-MUR-13-15 Given a sitting at 375 px, then a "Hantar" button is visible in the bottom bar on every question and, when pressed, opens the confirm "Hantar jawapan anda sekarang?".
  - AC-MUR-13-16 Given a sitting at 375 px, then the badge "Mod Peperiksaan" (or "Mod Latihan") is visible and "Lapor Soalan" sits inside the question card toolbar, not alone on its own row.
  - AC-MUR-13-17 Given a question whose answer or stem contains a matrix, when it is shown at 375, 768 or 1280 px, then it is rendered as a matrix notation and the page source contains no sentence "iaitu baris pertama"; a question stored as prose is flagged in the admin "Dilihat murid di" list.
  - AC-MUR-13-18 Given the navigator at 1280 px, then each of "Dijawab", "Ditanda", "Belum" has a visible colour key and a distinct shape or icon.
  - AC-MUR-13-20 Given 2 published and 1 draft Kertas Subjektif papers, when the pupil opens `/kertas-subjektif`, then exactly 2 papers are listed, the hub card shows "2 kertas", and the draft paper id returns 404.
  - AC-MUR-13-21 Given a published paper with a scheme, when the pupil opens it, then the page source does not contain the scheme text; after "Tunjuk Skema Pemarkahan" is pressed the scheme shows and "Sembunyi" hides it again.
  - AC-MUR-13-22 Given a paper with a Bahagian of 20 marks, when the pupil sets the self-mark to 25, then the saved value is 20; when set to 14, then the total shows 14 and reloading shows 14.
  - AC-MUR-13-23 Given no published Kertas Subjektif paper, then the index shows "Kertas subjektif sedang dalam penyediaan. Semak semula tidak lama lagi." and the hub card shows "0 kertas"; acceptance of D104 requires a fixture with at least 2 published papers (an empty module is not a pass).
  - AC-MUR-13-24 Given a Soalan Berstruktur part of 4 marks (attempt `paper_kind = 'structured'`, rows `mode = structured`; the same check on a Kertas Subjektif part uses `paper_kind` and mode `subjektif`), when the pupil self-marks 3 through `POST /api/bijak/attempts/:id/self-mark`, then the stored self-mark is 3, the pupil's Prestasi "Sesi" list shows the attempt with 3 / 4, and the answer store holds one row for that part with 3 awarded of 4 available; changing the self-mark to 2 updates that row (still one row) and takes no reward back.
  - AC-MUR-13-25 Given a pupil submits a Bijak sitting of 40 MCQ with 30 correct, then `practice_answers` holds 40 rows of that sitting's mode (30 correct), pupil Prestasi "Soalan Dijawab" rises by 40, the teacher and school-admin Prestasi, Analisa Item and the Heatmap (for Bab-linked questions) include them, and pressing Hantar twice leaves 40 rows (AC-CHAIN-2). Meaning of this id (D-20): ONLY the Hantar write to the single answer store and its idempotency; the Subjektif self-mark stored and listed is AC-MUR-13-24 (a citation of AC-MUR-13-25 for the self-mark, such as plan card S3-T06, must be re-cited as AC-MUR-13-24).
  - AC-MUR-13-26 Given a T5 pupil on `/spm/bijak`, then only the tab "Kertas Pilihan" is shown with no "Jana Kertas" tab or button, and opening the former Jana Kertas pupil URL returns 404 (FR-X2-2, D112(6)).
  - AC-MUR-13-19 Given a published question that says "Rajah 14 menunjukkan dua tin..." but has no figure (live UAT, Sains T4; also Rajah 11, 9, 7), then it is not served in Bijak, Kuiz, Databank, Latih Tubi or Soalan by Chapter, and the admin sees the reason.
- **Current gaps seen live on UAT/GitHub (2026-11-04)**: (1) at 375 px the sitting bottom bar has no "Hantar" (it exists at 768 and 1280); (2) at 375 px "Mod Peperiksaan" badge missing and "Lapor Soalan" alone on a row; (3) matrices written as prose at every width; (4) navigator legend without colour keys at 1280; (5) published Sains T4 questions that cite "Rajah n" have no diagram and are served in Latih Tubi (they are excluded); a stem shown twice is shown once and not excluded (D113). See 4.8 for the contract.
- **Current gap and root cause**: UAT 0 contracts and 0 papers (GAP 5.3); Tracking A and Kertas Subjektif admin 404; `spmPool:false` on admin create (`questions.service.ts:592`) limits Databank; answer widgets and stimulus kinds incomplete (`PartInput.vue`, `StimulusView.vue`); bridge refuses image stimuli (`be09-mapping.ts`); D94 self-mark reward not in base; hub "Tahun Tersedia" 0.
- **Fidelity deviations**: FD-MUR-18 to FD-MUR-24, plus section 4.6 deviations.
- **Decisions applied**: OQ-MUR-13, OQ-MUR-14 (OQ-MUR-7 is closed by D112(6)). (decided in section 6.1)

### R1-MUR-14 Heatmap Topik Lemah
- **Action**: Fix (page exists and works; the per-subject Bab rule of FR-MUR-14-3 and the single answer store of FR-MUR-14-1 are checked and fixed where they differ; API-DSKP-08 is "Exists-Fix")
- **Screen specification (from V2)** (route `/buku-nota/heatmap`, browser title "Heatmap Topik Lemah — PRESTASIPLUS"). Regions:
  1. Heading "Heatmap Topik Lemah", sub "Topik mana anda kuat, mana lemah — semua dalam satu paparan. Klik kotak merah untuk fokus belajar.".
  2. Legend pills: "Lemah (< 50%)", "Sederhana (50-79%)", "Mantap (≥ 80%)", "Belum cuba".
  3. Two tabs: "Senarai" (leads to the Buku Nota Saya page, see below) and "Heatmap Topik Lemah" (active).
  4. Empty state (observed): card titled "Heatmap Topik Lemah", "Belum ada data heatmap." / "Jawab soalan latih tubi dahulu — topik kuat dan lemah anda akan dipaparkan di sini." and button "Mula Latih Tubi" (opens Latih Tubi).
  - Populated heatmap (coloured topic tiles, tile click starts focused practice): Not observed in V2 — follow FR-MUR-14-* and the reference behaviour below. Loading and error: Not observed in V2 — follow FR-X6.
  - Tab "Senarai" opens `/buku-nota`, titled "Buku Nota Saya": heading "Buku Nota Saya", sub "Nota peribadi anda — tulis, kumpul dan ulangkaji ikut subjek anda sendiri."; tiles "Jumlah Nota", "Subjek Diliputi", "Bulan Ini" (0, 0, 0); the same two tabs; button "Nota Baharu" opening a form with "Tajuk", "Subjek (pilihan)" (select, first option "Tanpa Subjek", then the subject list), "Isi Nota" and button "Simpan Nota"; list controls "Subjek:" (select, "Semua" then subjects), "Susun:" (select "Per Subjek" / "Per Tarikh"), button "Tapis"; empty "Belum ada nota lagi." / "Mula dengan menambah nota peribadi pertama anda di atas.". This page is a Nota Ringkas page outside the matrix (section 1.3, hidden in V3): the "Senarai" tab link is hidden in 1.0 (FR-MUR-14-4).
- **Confirmed in the screens (earlier review)**: Confirmed: heading, subtitle, the four legend pills, tabs "Senarai" and "Heatmap Topik Lemah", empty state "Belum ada data heatmap." / "Jawab soalan latih tubi dahulu — topik kuat dan lemah anda akan dipaparkan di sini." and "Mula Latih Tubi". A populated heatmap is not in the screens (E-15).
- **Current gap and root cause**: `HeatmapTopikLemahPage.vue` and `GET buku-nota/heatmap` work; check them against the per-subject Bab-or-SP rule (FR-MUR-14-3) and that the heatmap reads `practice_answers` of every mode (FR-MUR-14-1); the UAT data dependency (no Bab/SP links) is tracked in OQ-MUR-6. Decided (D115, D-D): V3 contract `HEATMAP_MIN_ATTEMPTS = 5` and no grey state are changed: no minimum attempts (tile text "{n} cuba"), a chapter of a practised subject with no attempt is a grey "Belum cuba" tile, the API returns accuracy with one decimal (or null) and the tile shows the whole number rounded half up (60 API-DSKP-08); the V3 tile style stays. Decided (D115, D-D): V3 contract `HEATMAP_MIN_ATTEMPTS = 5` and no grey state are changed: no minimum attempts (tile text "{n} cuba"), a chapter of a practised subject with no attempt is a grey "Belum cuba" tile, the API returns accuracy with one decimal (or null) and the tile shows the whole number rounded half up (60 API-DSKP-08); the V3 tile style stays.
- **Field & behaviour spec** (no filter; the unit is Bab, D89)
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Tabs "Senarai" / "Heatmap Topik Lemah" | tabs | - | Heatmap | "Senarai" is hidden in 1.0 | - | - | - | - |
  | Subject blocks | read-only | - | `Belum ada data heatmap lagi.` (copy of the screen specification) | subjects with at least one attempt on a Bab-linked question, all chapters of the subject, Bab number ascending; subject order Subjek Teras first then name asc; window all time; refreshed on each page load | - | - | - | API-DSKP-08 |
  | Tile text | read-only / link | - | - | `{n} cuba · {acc}% betul` with acc = round half up(correct / attempts x 100); colours red below 50, amber 50-79, green at least 80, grey = no attempts; a tile opens Soalan by Chapter of its subject (V2 link, FR-MUR-14-2, D115) | - | - | - | API-PRAC-01 |
  - Behaviour: reads `practice_answers` of every mode (games included) for questions linked to a Bab. The per-subject rule of FR-MUR-14-3 stays (Bab tiles only when the subject has any Bab-linked approved question for the Tingkatan, else SP tiles).
  - New requirements: FR-MUR-14-7 Tile colours use the whole-number percent and the bands above. FR-MUR-14-8 A subject without any attempt is not listed.
  - New acceptance criteria: AC-MUR-14-5 Given 7 attempts with 4 correct on a Bab, then the tile reads `7 cuba · 57% betul` and is amber.
- **Name**: "Heatmap Topik Lemah" (sub "Topik mana anda kuat, mana lemah — dalam satu paparan")
- **Route**: `/buku-nota/heatmap`. **Matrix row**: 14. **Priority**: P1.
- **Current status**: V3 GH works (1 tile), UAT empty (no chapter or SP tags).
- **Outcome**: one view of strong and weak topics.
- **Reference behaviour (V2 `pelajar/buku-nota-heatmap.blade.php`)**: hero "Heatmap Topik Lemah" / "Topik mana anda kuat, mana lemah — semua dalam satu paparan. Klik kotak merah untuk fokus belajar."; legend pills "Lemah (< 50%)", "Sederhana (50-79%)", "Mantap (≥ 80%)", "Belum cuba"; tabs "Senarai" and "Heatmap Topik Lemah"; per subject block with grid of chapter tiles: title, "{n} cuba · {acc}% betul" or "Belum cuba"; colours red below 50, amber 50-79, green at least 80, grey none. Subjects shown = those where the pupil attempted at least one chapter-linked question; all chapters of that subject are listed. Empty: "Belum ada data heatmap." / "Jawab soalan latih tubi dahulu — topik kuat dan lemah anda akan dipaparkan di sini." and button "Mula Latih Tubi".
- **Functional requirements**
  - FR-MUR-14-1 Own attempts only, read from the single answer store `practice_answers` (every mode, FR-MUR-4-5); accuracy = round(correct/attempts x 100) per chapter (whole number, pooled).
  - FR-MUR-14-2 Colours and legend as above; a tile click follows V2's working link, `/practice/chapter` of that tile's subject (`/practice/chapter/{code}`); **D115 (audit mn-5): FD-MUR-25's chapter-specific deep link is reverted because V2's link works (D9: replicate what works) and a deeper link adds a feature.** The V2 "Cikgu Pakar" block, if present on the page, is hidden in R1 (Cikgu Alesa/AI surfaces are hidden, D73/D102).
  - FR-MUR-14-3 The tile unit is Bab (D89). Rule per subject: if any approved question of the subject and Tingkatan has a Bab, the Heatmap of that subject uses Bab tiles only and ignores SP; only a subject where no question has a Bab uses SP tiles (OQ-MUR-6). Because a question cannot be published without Bab and SP (D-A5), the SP fallback applies to legacy questions only.
  - FR-MUR-14-4 The "Senarai" tab link is hidden in 1.0 (Buku Nota is out of scope).
  - FR-MUR-14-5 Empty state exact copy; button opens Latih Tubi.
  - FR-MUR-14-6 Subjects and chapters of the pupil's forms T1-T5 (D101); no Darjah.
- **Data and dependencies**: attempts (M05), chapters/Bab (M03/M04). Heatmap API `GET buku-nota/heatmap` (exists).
- **Acceptance criteria**
  - AC-MUR-14-1 Given 4 correct of 10 in a chapter, then tile red "10 cuba · 40% betul".
  - AC-MUR-14-2 Given an unattempted chapter of a practised subject, then grey "Belum cuba".
  - AC-MUR-14-3 Given no attempts on chapter-linked questions (UAT now), then the empty state shows with no error.
  - AC-MUR-14-4 Given a pupil with 6 chapter tiles in one subject and a 375x667 viewport, when the heatmap loads, then the tiles are laid out in exactly 1 column when the container width is below 400 px (otherwise at most 2), the four legend pills break onto at least 2 lines without clipping, and `scrollWidth <= innerWidth`; at 1280 px the tile grid uses auto-fill with a 200 px minimum width.
- **Current gap**: no Bab/SP links on UAT. **Fidelity deviations**: FD-MUR-25. **Decisions applied**: OQ-MUR-6. (decided in section 6.1)

### R1-MUR-16 Latih Tubi
- **Action**: Fix
- **Screen specification (from V2)**: no V2 capture exists. V2 routes `/practice`, `/practice/{code}` and `/latih-tubi` redirect the pupil to the Dashboard (the feature is flagged off in V2), so the subject list, setup screens (Pilih Tahap, Kesukaran, Bilangan) and result are Not observed in V2 — follow FR-MUR-16-* and the V1 flow written below. The quiz screen itself uses the same engine as the SPM Databank quiz (screen S4 in R1-MUR-13), which was observed. Written from that screen: header with subject and "Soalan {i} daripada {n}", clock label "Masa", line "🔀 Soalan dan pilihan jawapan dirawak setiap sesi.", chip "✓ Mengikut DSKP", credit line "💬 Soalan oleh: {role label}", options A to D with ✅/❌ marks after checking, buttons "✓ Semak Jawapan" and "Soalan Seterusnya →"; result "Kuiz Selesai!" (see the next line). Loading and error: Not observed in V2 — follow FR-X6.
- **Quiz engine notes (earlier review of the nearest V2 screen)**: the closest V2 quiz screen is the Databank quiz (same quiz engine: "Soalan 1 daripada 5", timer "Masa", "🔀 Soalan dan pilihan jawapan dirawak setiap sesi.", chip "✓ Mengikut DSKP", label "💬 Soalan oleh: Admin PRESTASI+", button "✓ Semak Jawapan", "Soalan Seterusnya →", result "Kuiz Selesai!" with "Markah", "Ketepatan", "Masa: mm:ss", "↻ Cuba Lagi", "Senarai Subjek"). **Correction**: the check button reads "✓ Semak Jawapan" (not "✓ Semak"). The setup screens (Pilih Tahap, Kesukaran, Bilangan) come from V1 `docs/discovery/M05-practice.md`; see E-16.
- **Current gap and root cause (change list; reuse `PracticeListPage.vue`, the quiz pages, `practice/sessions`)**: (1) remove the lower-form gate (`PracticeListPage.vue:29,55-58`, `src/lib/lower-form.ts`); (2) `apps/api/src/modules/practice/rules.ts:40-45` (the T1-T3 "akan datang" gap is at lines 43-45) offer T1-T5; (3) serve figure questions and whole groups (`be09-practice-mapping.ts:27-39`); (4) exclude figure-less questions (a question whose stem is duplicated is shown once and is not excluded, FR-MUR-QP-5); (5) rename the check button "✓ Semak Jawapan" where it reads "✓ Semak".
- **End-to-end flow**: see 46 section 4.8 (D1 Latih Tubi) with 2 (answering engine), 3 (marking) and 3.7 (result). This block keeps the setup fields.
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Subject cards (headings "Subjek Teras", "Subjek Elektif"; button "Mula Latihan") | card list | - | - | API-PRAC-04: subjects with at least one servable question for the pupil's form; Teras group first, name asc inside a group; card = name, English name, "{n} soalan", badge "Teras" | empty: `Tiada subjek tersedia untuk tahap ini.` | - | - | API-PRAC-04 |
  | Pilih Tahap Pendidikan | single-select cards | Ya | the pupil's own form | OPT-TINGKATAN for forms with servable questions, each "{n} soalan", then "Semua Tahap" (`all`); a form with 0 is disabled "0 soalan"; T1..T5 are ALL offered by the API (the `OFFERED_LEVEL_CODES` = T4, T5 limit at `rules.ts:40-45` is removed) | - | OPT-TINGKATAN | `levelId` | API-PRAC-01 |
  | Pilih Tahap Kesukaran | single-select | Ya | "Semua" (`null`) | OPT-KESUKARAN with live counts: Sangat Mudah 1 … Sangat Sukar 5; a choice with 0 is disabled; the summary label for "Semua" is "Semua Kesukaran" (K21; the code prints "Semua Tahap" at `PracticeConfigPage.vue:301`) | - | level | `difficulty` | same |
  | Bilangan Soalan | single-select | Ya | 10 | OPT-BILANGAN-LT: 5, 10, 15, 20; above the available number the option is disabled; amber warning title `Soalan Tidak Mencukupi`, text `Kurangkan bilangan soalan atau tukar tetapan penapisan.` and "Mula Kuiz" disabled | - | level, difficulty | `count` | same |
  | Ringkasan | read-only | - | - | rows Tahap Pendidikan, Kesukaran, Bilangan Soalan, Soalan Tersedia; text `Bersedia untuk bermula!` | - | - | - | - |
  | Mula Kuiz | button | - | - | `POST /api/practice/sessions` {mode `latih_tubi`, subjectCode, levelId, difficulty, count, clientUuid}; `clientUuid` is made once per press so a double press returns the same session | 422 `Soalan tidak mencukupi.`; 402 `Baki percubaan percuma anda telah habis.`; empty draw `Tiada soalan untuk pilihan ini.` | - | session + rows `latih_tubi` | API-PRAC-01 |
  | Answer screen | see 46 section 2.1 and 2.2 | - | - | MCQ and true/false; options shuffled and re-lettered per session; "✓ Semak Jawapan" disabled until a choice and while offline (title `Perlukan sambungan internet.`); feedback "Betul!" / "Salah"; "Soalan Seterusnya →", "Tamat →"; Masa counts up and is paused when the tab is hidden for more than 60 s | 409 `Sesi ini sudah dihantar.` shows the result | - | one row per checked question | API-PRAC-02, API-PRAC-03 |
  | Leave dialog | B-050 | - | - | title `Keluar daripada kuiz?`, body `Jawapan yang sudah disemak telah disimpan. Anda boleh menyambung semula kuiz ini.`, buttons "Keluar" / "Teruskan Kuiz" (default focus); not shown when nothing is answered | - | - | - | - |
  - Behaviour: the T1-T3 "akan datang" gate is removed from the UI (`PracticeListPage.vue:29,55-58`, `lib/lower-form.ts`) AND from the API (`rules.ts:43-45` is the verified gap: T1-T3 return "akan datang"); T1-T5 are served wherever questions exist (D101). Reload of `/practice/:code/quiz` re-calls start with the stored `clientUuid` and resumes at the first unanswered question with the line `Anda menyambung kuiz yang belum selesai.` once. Result tiles: Markah {correct}/{n}, Ketepatan whole number, Syiling = rate x correct, XP = 10 x correct (rate = admin setting, default 1). A duplicated stem is shown once and not excluded (D113).
  - Free-trial rule (existing behaviour kept unchanged; owner S5-T03 with the Latih Tubi start call): a pupil without an active subscription has 50 checked answers (error code `TRIAL_EXHAUSTED`, ERR-PRAC-01); each `check-answer` adds 1 to the used count; `POST /api/practice/sessions` for such a pupil with 0 remaining answers 402 ERR-PRAC-01 `Baki percubaan percuma anda telah habis.`; a subscribed pupil is never limited; the Dashboard card "Percubaan Percuma" shows `Baki {n} / 50 soalan` from the same count. R1 adds no new quota rule.
  - New requirements: FR-MUR-16-13 `rules.ts:43-45` no longer returns "akan datang" for T1-T3; `GET /api/practice/subjects` and the start call accept every T1-T5 code. FR-MUR-16-14 The summary text for all difficulties is "Semua Kesukaran". FR-MUR-16-15 A duplicated stem is shown once and never excluded (D113). FR-MUR-16-16 Reload mid-drill resumes the same session (idempotent start).
  - New acceptance criteria: AC-MUR-16-9 Given a T2 pupil and servable T2 questions, when `/practice` and the start call run, then subjects load, a session starts and no text or API field contains "akan datang". AC-MUR-16-10 Given difficulty "Semua", then the summary reads "Semua Kesukaran". AC-MUR-16-11 Given the pupil reloads the quiz after answering 3 of 10, then the quiz reopens at question 4 with `Anda menyambung kuiz yang belum selesai.`.
- **Name**: "Latih Tubi" (sub "Pilih subjek dan mula berlatih!", V1 hero "Latih Tubi 🎯")
- **Route**: `/practice`, `/practice/:code`, `/practice/:code/quiz`. **Matrix row**: 16 (user addition). **Priority**: P0.
- **Current status**: GH works end to end. UAT T5: Matematik 1,018, Sains 2,551, Sejarah 904, BI 805, BM 411 with difficulty; T1: "akan datang". V2 production flag is OFF (`/practice` redirects to Dashboard), so V1 and the V2 mechanism doc are the references; V3 visible per D80 Q-02.
- **Outcome**: fast random drills by subject.
- **Reference behaviour (V1 S2-S3, V2 mechanism §2.1)**: subject cards "Subjek Teras" first, name, English name, "{n} soalan", "Teras" badge, "Mula Latihan"; banner "Soalan by Chapter". Setup: "← Kembali ke Senarai Subjek", "{n} soalan tersedia", "Pilih Tahap Pendidikan" (only T4, T5 and "Semua Tahap"), "Pilih Tahap Kesukaran" (1 "Sangat Mudah" ... 5 "Sangat Sukar" with live counts, or "Semua"), "Bilangan Soalan" 5, 10 (default), 15, 20, summary "Ringkasan" (Tahap Pendidikan, Kesukaran, Bilangan Soalan, Soalan Tersedia), amber "Soalan Tidak Mencukupi" / "Kurangkan bilangan soalan atau tukar tetapan penapisan." when available is fewer than chosen (button disabled), "Bersedia untuk bermula!", button "Mula Kuiz". Quiz: one question per screen, "Soalan {i} daripada {n}", timer "Masa", "🔀 Soalan dan pilihan jawapan dirawak setiap sesi.", chip "✓ Mengikut DSKP" when tagged, options A-D (shuffled and re-lettered per session), "💬 Soalan oleh: …" label only when the question has an author credit, "✓ Semak" (disabled until a choice is made) then ✅/❌, "🎉 Betul!" or "😟 Salah" (V3 "Betul! +10"), optional "Penjelasan:", "Soalan Seterusnya →" / "Tamat →", "Lapor Soalan". Result: "Kuiz Selesai!", "Tahniah, anda telah lengkapkan {subject}.", tiles Markah, Ketepatan, "🪙 Syiling", buttons "↻ Cuba Lagi", "Senarai Subjek". Empty: "Tiada soalan untuk pilihan ini.". Rewards: Syiling per correct answer = the admin setting "Syiling flat / soalan betul" (V2 observed value 1) and 10 mata per correct answer (V2 `PracticeRecorder`; the Syiling constant of 2 in that code is superseded by the setting, 4.4).
- **Functional requirements** (4.6 applies)
  - FR-MUR-16-1 The subject list shows subjects with at least one servable question for the pupil's level, "Subjek Teras" first, with "{n} soalan" per D91.
  - FR-MUR-16-2 Level choices are Tingkatan 1 to 5 that have servable questions, plus "Semua Tahap" (D101); no Darjah anywhere (D72). The default is the pupil's own form. The API offers T1-T5 (today `OFFERED_LEVEL_CODES` = T4, T5 at `apps/api/src/modules/practice/rules.ts:40-45` (the T1-T3 "akan datang" gap is at lines 43-45)).
  - FR-MUR-16-3 Difficulty (1 to 5) is stored on the question separately from TP (1 to 6); the five labels are difficulty 1 "Sangat Mudah", 2 "Mudah", 3 "Sederhana", 4 "Sukar", 5 "Sangat Sukar"; counts per label are drawable counts. Where the admin has not typed a difficulty, it is the code's derivation `min(5, TP)` (TP 6 reads as 5, "Sangat Sukar"). Any three-label "Kesukaran" (Mudah / Sederhana / Sukar) shown to a pupil or teacher is derived from difficulty with the single mapping used by the code: 1-2 "Mudah", 3 "Sederhana", 4-5 "Sukar" (documented in 50-data-model-erd). The stars of a teacher question are the same 1 to 5 difficulty.
  - FR-MUR-16-4 Count choices 5, 10 (default), 15, 20; when fewer are available the warning shows and Start is disabled.
  - FR-MUR-16-5 Latih Tubi serves MCQ questions including figure questions and whole stimulus groups (D105): a group is drawn whole, its members contiguous in published order, its stimulus shown once above them; the quiz length equals the chosen count by adding whole groups while they fit, then ungrouped questions; if only a group that overshoots remains, the quiz is shorter than the count by fewer than the group size and the result screen shows the line `Kuiz ini mempunyai {n} soalan kerana kumpulan soalan tidak dipecahkan.` ({n} = questions served); a question whose figure is missing is never drawn (admin sees the reason).
  - FR-MUR-16-6 Options and question order are shuffled per session; the server grades by option identity; the key is not in the page before "✓ Semak" (server-trust per the findings doc; V2 shipped the correct flag in the page: FD-MUR-26).
  - FR-MUR-16-7 Each answer is written once to the single answer store `practice_answers` (mode `latih_tubi`, `chapter`, ...; FR-MUR-4-5) together with its session, accuracy and time; rewards: the admin-set Syiling rate (default 1) + 10 mata per correct answer, shown on the result and added to the header pills.
  - FR-MUR-16-8 "Lapor Soalan" is reachable from every question card (R1-MUR-54).
  - FR-MUR-16-9 Maths, units, chemical formulas and RTL text render per 4.6.
  - FR-MUR-16-10 Result and "Cuba Lagi" as above; "Ulang Kaji" later reads the same attempts.
  - FR-MUR-16-11 A T1-T3 pupil gets the same subject list, setup and quiz as a T4-T5 pupil for their own form (D101); `src/lib/lower-form.ts` and its use in `PracticeListPage.vue:29,55-58` are removed.
  - FR-MUR-16-12 Session mode is stored as `latih_tubi`, chapter drills as `chapter`, focus drills keep the topic id.
- **Data and dependencies**: questions (owner M04, servable = approved), practice (owner M05), wallet (M14). Admin feed: Studio approval and level, subject, TP tags (R1-ADM Studio, Latih Tubi lane in SPM hub).
- **Acceptance criteria**
  - AC-MUR-16-1 Given a T5 pupil on UAT, when Latih Tubi opens, then Matematik, Sains, Sejarah, BI and BM show counts equal to the drawable counts and no Darjah.
  - AC-MUR-16-2 Given a test bank of Matematik with 20 single MCQs, 3 figure MCQs and one group of 3 members, when the pupil starts 10 questions, then 10 distinct questions are served (the bank has enough single questions to fill the count exactly, so no shorter quiz and no summary line), every group present has all 3 members adjacent in published order and its figure is rendered once above them, and no group member appears without its siblings. Given a bank of Matematik holding only two groups of 4 members each (8 available, so the count 5 is enabled), when the pupil starts 5 questions, then 4 questions are served (one whole group; the second group would overshoot) and the result shows `Kuiz ini mempunyai 4 soalan kerana kumpulan soalan tidak dipecahkan.`.
  - AC-MUR-16-3 Given the quiz page source, then no option carries a correctness flag.
  - AC-MUR-16-4 Given the admin setting "Syiling flat / soalan betul" = 1 (the default) and 7 of 10 correct, then the result shows Markah 7/10, Ketepatan 70%, 7 Syiling and the wallet increases by 7 Syiling and 70 mata; given the admin then sets the rate to 3, the next session with 7 of 10 correct earns 21 Syiling and 70 mata (this rate-3 clause is `[UAT]` after S7-T05); and 10 rows are written to `practice_answers` for each session.
  - AC-MUR-16-5 Given only 4 questions available and 10 chosen, then the warning shows and Start is disabled.
  - AC-MUR-16-6 Given a T1 pupil and a T5 pupil and a data precondition of at least 10 servable Matematik MCQs for T1 and for T5, when each opens Latih Tubi and starts Matematik with 10 questions, then each quiz serves 10 questions of that pupil's own form and no page text contains "akan datang".
  - AC-MUR-16-7 Given 375 px, then options are full-width targets and "✓ Semak Jawapan" stays reachable with a long stem (US-22.4).
  - AC-MUR-16-8 Given a Sains T4 question that cites "Rajah 14" without a figure asset (live UAT case), when Latih Tubi builds a draw, then that question is never served and the subject card count excludes it (4.8); a question whose stem text appears twice is shown once and stays served and counted (D113).
- **Current gap and root cause**: T1-T3 content (D72, `rules.ts:42-43` offered levels T4/T5; `lower-form.ts`); pool-tag dependence (`spmPool`).
- **Fidelity deviations**: FD-MUR-17, FD-MUR-26. **Decisions applied**: OQ-MUR-1. (decided in section 6.1)

### R1-MUR-21 Permainan
- **Action**: Complete (the games work in V3, but the Battle Arena simulated multiplayer and robot opponent, the removal of the bot pool, the writes of every question-based game to the single answer store, FR-MUR-21-4, and the coin rate from the admin setting are built under card S7-T01 and 48)
- **Screen specification (from V2)**. The V2 games hub `/permainan` redirects the pupil to the Dashboard (flag off), so the hub is Not observed in V2 — follow FR-MUR-21-* and the V1 hub described below (E-7). Only the V2 Battle Arena was observed:
  **Battle Arena `/battle`** (title "Battle — Lawan Rakan — PRESTASIPLUS"). Regions: (1) heading "Battle Arena" with badge "BARU" and line "Cabar kawan, cari lawan, atau wakili sekolah anda!"; (2) three header buttons "Ranking Pelajar", "Ranking Sekolah" (opens the school ranking page below), "Cabaran Masuk" (incoming challenges); (3) mode tabs "Biasa", "PKSK", "SPM"; (4) "Pilih Subjek" with group "Subjek Teras" (Bahasa Melayu, Bahasa Inggeris, Matematik, Sains, Sejarah, Pendidikan Islam, Pendidikan Moral) and group "Subjek Elektif" (24 subjects behind a toggle "Lagi 24 subjek elektif" / "Sembunyikan"); (5) "Bilangan Soalan" chips 5, 10, 15, 20; (6) for the PKSK tab "Pilih Domain PKSK", cards of domain name and "{n} soalan" (about 18 domains in V2, e.g. "Alam Sekitar" 40, "Kecerdasan Insaniah" 147); (7) "Pilih Tahap" listing Darjah 1 to Darjah 6 (V2 differs: Darjah must not appear, FR-MUR-SH-8; V3 lists Tingkatan 1-5 or the pupil's own form only); (8) three match cards "Quick Match" ("Cari lawan rawak dari darjah yang sama"; V3: "dari tingkatan yang sama"), "Cabar Kawan" ("Hantar cabaran kepada rakan anda"), "Battle Sekolah" ("Lawan pelajar dari sekolah lain!"); (9) queue toggle "Keterlihatan Barisan" with "Hanya pelajar gred sama boleh match" and chip "Gred Saya"; (10) waiting overlays "Mencari Lawan..." / "Menunggu pelajar sama gred & subjek" with a timer "0:00" and button "Batal", and "Menunggu Kelulusan..." / "Menunggu {name} menerima permohonan anda" with "Batal"; (11) "Cabar Kawan" panel: empty "Tiada pelajar dijumpai"; "Cabaran Masuk" panel: empty "Tiada cabaran buat masa ini"; (12) list "Battle Terkini" / "10 pertandingan paling terkini": rows with ⚔️, "1v1", subject, relative date (English "4 months ago": defect, V3 prints BM) and a status chip (observed "Sedang").
  **Ranking Sekolah `/battle/ranking-sekolah`** (title "Ranking Sekolah — Battle — PRESTASIPLUS"): label "🏫 Pertandingan Antara Sekolah", heading "Ranking Sekolah", text "Sekolah terbaik dinilai berdasarkan jumlah mata, kemenangan, dan ketepatan battle."; empty state 🏫 "Tiada ranking lagi" / "Belum ada sekolah yang menyertai battle. Mulakan pertandingan sekarang!". Populated rows: Not observed in V2.
  - Question screens, results, loading and error: Not observed in V2 — follow FR-MUR-21-* and section 4.6.
- **Current gap and root cause**: the games themselves work for the pupil (V3 exceeds V2); the gap is the robot opponent rule (D-PA-9), the answer-store writes and the admin-set coin rate, all specified in 48 and built by S7-T01; level pickers list Tingkatan 1-5 only (FR-MUR-21-3).
- **End-to-end flow**: see 48 GAME-00 (common rules), GAME-01 (Battle Arena), GAME-R and GAME-02..07 (room games), GAME-S and GAME-08..12 (solo mini-games), GAME-13 (Jutawan Ilmu), GAME-14 (Roda Nasib), GAME-16 (Ranking Sekolah and Sekolah Bersaing). This block keeps only the module-specific fields.
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Hub game cards | links | - | - | only games that have playable content for the pupil (FR-MUR-21-1); a game with no content is hidden | - | - | - | games read |
  | Kod Bilik | text, 6 characters A-Z0-9 | Ya | empty | upper-cased on input | `Kod bilik tidak sah.` (ERR-GAME-06) | - | - | rooms API (48 GAME-R) |
  | Subjek, Tahap, Maks Pemain, Bilangan Soalan | selects | Ya | pupil's form | OPT-SUBJEK, OPT-TINGKATAN (T1-T5 only), players per game, OPT-BILANGAN-LT | `Soalan tidak mencukupi.` (ERR-GAME-01) | - | - | 48 GAME-R |
  - Behaviour: real pupils first; after 30 s without a human opponent a clearly labelled "Robot PrestasiPlus" joins and never impersonates a real pupil, never enters standings, badges or leagues (D113, 48 D-GAME-1). Game coins are the admin setting `games_award_syiling`, default off (XP only), with daily caps (48 section 2). Every game that shows bank questions writes each answer to `practice_answers` with its game mode (D113-b; modes `battle` and the game modes of OPT-MODE-SESI). Other pupils appear by first name only, no school (0A.3). A game that cannot render a figure or group skips that question.
  - New requirements: FR-MUR-21-8 Every game question answer is one `practice_answers` row with the game mode and is counted in "Soalan Dijawab" and "Ketepatan" but not in "Sesi Kuiz" (D-PA-18). FR-MUR-21-9 The robot opponent is labelled "Robot PrestasiPlus" everywhere it appears.
  - New acceptance criteria: AC-MUR-21-7 Given a Quick Match with no human for 30 s, then the opponent shows "Robot PrestasiPlus", rows of mode `battle` exist for the pupil only and no standing changes (AC-CHAIN-10 (c)).
- **Name**: "Permainan" (page "🎮 Zona Permainan", V1 text "Main sambil belajar! Kumpul Syiling, naik ranking, dan jadi champion sekolah. Pilih permainan kegemaran kamu.")
- **Route**: `/permainan`, `/battle`, game routes. **Matrix row**: 21. **Priority**: P1.
- **Current status**: V3 Zona Permainan richer than V2 (Papan Bijak, Battle Arena, Perang Fakta, Benteng Ilmu, Perlumbaan Matematik, Kuiz Relay, Roda Nasib, Jutawan, etc.). V2: `/permainan` OFF (redirects to Dashboard); `/battle` reachable (Ranking Pelajar/Sekolah, Quick Match, Cabar Kawan, Battle Sekolah).
- **Outcome**: learn by playing; coins and ranking.
- **Reference behaviour**: V1 hub (M16 S6): open-rooms strip "Tiada bilik terbuka buat masa ini." / "Cipta bilik permainan dan jemput rakan-rakan!"; card per game with badge, chips and button; Papan Bijak lobby: "Cipta Bilik Baru" (Subjek, Tahap Soalan auto from profile, "Siapa Boleh Join?", "Maks Pemain"), "Masuk Bilik" (6-character code), "Cari Lawan Auto", "Cara Bermain". V2 Battle Arena (flag-free). Questions for games: V2 draws MCQ with status not "menunggu"; Battle uses approved only (mixed rule, FD-MUR-27).
- **Functional requirements**
  - FR-MUR-21-1 The hub lists the V3 games that work with the servable bank; a game without playable content is hidden (no 500 page such as V1 "Sambung Kata").
  - FR-MUR-21-2 Game questions are approved standalone text-only MCQ questions only (all games and Battle; servability activity `permainan`: no stimulus group, no figure, no option image; a question with a group or a figure is never drawn by a game, L-12 / D113), level of the room within T1-T5.
  - FR-MUR-21-3 Level pickers list Tingkatan 1-5 only (V1 offered Darjah 1-6, D72).
  - FR-MUR-21-4 Coins and ranking use the shared wallet; the admin setting "Mini-games beri syiling?" decides whether a game credits Syiling (V2 value "Tidak (XP sahaja)": XP only), and where it credits, the rate is the admin Syiling rate of 4.4, not a game constant. Every game that asks bank questions writes each answer to the single answer store `practice_answers` (mode `game` unless the API names another, API-PRAC-01) so the rows count in Prestasi, Analisa Item, Heatmap and the teacher and admin reports (FR-X4-5); a game result without a bank question (for example a pure speed score) writes no answer row.
  - FR-MUR-21-5 Room codes are 6 characters; a wrong code shows a BM error.
  - FR-MUR-21-6 Pupils see only their own and public room data; no personal data of other pupils beyond the display name (first name only, no school, section 4.3).
  - FR-MUR-21-7 The hub and lobbies pass 375/768/1280 px.
- **Data and dependencies**: owner M16; questions from M04 pool; admin Tetapan Permainan screen missing (GAP 5.1; cross-ref admin PRD).
- **Acceptance criteria**
  - AC-MUR-21-1 Given a pupil, when `/permainan` opens, then game cards render and each opens without 500.
  - AC-MUR-21-2 Given a draft question, then it never appears in any game.
  - AC-MUR-21-3 Given the level picker, then no Darjah option.
  - AC-MUR-21-4 Given a room code of 5 characters, then the form refuses it with a BM message.
  - AC-MUR-21-5 Given 375 px, then cards are one column and the board fits without sideways scroll.
  - AC-MUR-21-6 Given a pupil answers 5 bank questions in a question-based game (3 correct), then `practice_answers` holds 5 rows of the game mode (3 correct) and the pupil's Prestasi "Soalan Dijawab" rises by 5; with "Mini-games beri syiling?" = Tidak, no Syiling is credited and XP is.
- **Current gap**: games that ask bank questions must be checked for answer rows in `practice_answers` and for the reward rate source (FR-MUR-21-4); V3 otherwise exceeds V2; level picker defaults to be checked. **Fidelity deviations**: FD-MUR-27. **Decisions applied**: none needed.

### R1-MUR-54 Laporan Soalan
- **Action**: Fix
- **Screen specification (from V2)** (route `/laporan-soalan`, browser title "Laporan Soalan Saya — PRESTASIPLUS"). Regions: (1) a row of counters, value above label: "Jumlah", "Menunggu", "Disemak", "Diperbaiki", "Ditolak" (V3 adds "Dikeluarkan"); (2) the list of the pupil's own reports; empty state (observed) 📋 "Tiada Laporan" / "Anda belum menghantar sebarang laporan soalan.". No button on the page. Populated rows (fields, status chips) and the report dialog opened from a question: Not observed in V2 — follow FR-MUR-54-* and the reference behaviour below. Loading and error: Not observed in V2 — follow FR-X6.
- **Confirmed in the screens (earlier review)**: Confirmed: five counters "Jumlah", "Menunggu", "Disemak", "Diperbaiki", "Ditolak" (all 0) and the empty state "Tiada Laporan" / "Anda belum menghantar sebarang laporan soalan."; the PRD keeps the five counters and shows "Dikeluarkan" as a card badge counted under "Diperbaiki" (FD-MUR-34). The report dialog is not in the screens (E-5).
- **Current gap and root cause (change list; reuse `LaporanSoalanPage.vue`, `routes/my-reports.ts:11`, `question-reports`)**: (1) add `/laporan-soalan` to the pupil scope (`src/app/prototype-scope.ts` STUDENT_ITEMS has no row 54) and add the sidebar item; (2) keep five counters, count "Dikeluarkan" under "Diperbaiki" and remove any "Selesai" label; (3) the dialog and the API rules of D98 (own attempt only, per-pupil cap).
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Counters "Jumlah", "Menunggu", "Disemak", "Diperbaiki", "Ditolak" | 5 read-only tiles | - | 0 | Jumlah = all own reports = the sum of the other four; a report whose question was removed ("Dikeluarkan", set when the admin archives the question) is counted under "Diperbaiki" and its card badge reads "Dikeluarkan" | - | - | - | API-Q-20 `mine` |
  | Report cards | read-only list | - | `Tiada Laporan` / `Anda belum menghantar sebarang laporan soalan.` | newest first, 20 per page; card = type chip (`Duplikasi`, `Soalan Kabur`, `Salah Jawapan`, `Kesalahan Taip`; for the reasons below the chip shows the first reason: `Jawapan Salah`, `Tak Jelas`, `Lain-lain`), subject, text (2 lines), comment, `Dihantar {d M Y}`, status badge (OPT-STATUS-LAPORAN), admin note when present | - | - | - | same |
  | Sebab Laporan * | checkbox list, at least one | Ya | none | OPT-REPORT-REASON-MCQ (7) or OPT-REPORT-REASON-STRUCT (5) by question kind; the pupil never sees `outdated` | `Sila pilih sekurang-kurangnya satu sebab laporan.` and the submit button is disabled | question kind | `reasons[]` | API-Q-19 |
  | Komen Tambahan (pilihan) | textarea, placeholder "Terangkan masalah soalan ini...", counter `{n}/500` | Tidak | empty | - | `Komen tidak boleh melebihi 500 aksara.` | - | `note` | same |
  | Batal / Hantar Laporan | buttons | - | - | "Menghantar..." while sending | success view `Terima Kasih!` / `Laporan berjaya dihantar.`; failure `Gagal menghantar laporan. Sila cuba lagi.` with the text kept (K13); 429 `Anda telah mencapai had 20 laporan sehari. Sila cuba lagi esok.` (ERR-QUOTA-02); 403 `Anda hanya boleh melapor soalan yang dipaparkan kepada anda.`; second report of the same version (409) `Anda sudah melaporkan soalan ini.` | - | - | same |
  - Behaviour: state machine `pending` ("Menunggu") -> `reviewed` ("Disemak") -> `fixed` ("Diperbaiki") or `dismissed` ("Ditolak"); `fixed` plus an inactive question shows "Dikeluarkan"; the admin can never set a report back to pending; a legacy "selesai" shows "Diperbaiki". The server fills the source (`spm`, `structured_attempt`, `latihan`, `revision`) per screen. Report text and identity never go to an AI service.
  - New requirements: FR-MUR-54-9 The page shows FIVE counters (live page behaviour kept; supersedes the six-counter text of FR-MUR-54-2). FR-MUR-54-10 The duplicate-report refusal text is `Anda sudah melaporkan soalan ini.`.
  - New acceptance criteria: AC-MUR-54-7 Given 5 reports (1 Menunggu, 1 Disemak, 1 Diperbaiki, 1 Ditolak, 1 Dikeluarkan), then the tiles read Jumlah 5, Menunggu 1, Disemak 1, Diperbaiki 2, Ditolak 1 and the card of the removed one has the badge "Dikeluarkan".
- **Name**: "Laporan Soalan" (page "Laporan Soalan Saya", sub "Jejak status laporan soalan yang anda hantar")
- **Route**: `/laporan-soalan`; the report action is inside quiz, attempt and Semakan screens. **Matrix row**: 54. **Priority**: P0.
- **Current status**: V3 both: no menu item; `/laporan-soalan` redirected to Dashboard by `prototype-scope.ts` (D43); page `my-reports.ts` exists; the "Lapor Soalan" button in the quiz exists.
- **Outcome**: report a wrong question and see what happened.
- **Reference behaviour**
  - List (V2 `pelajar/laporan-soalan.blade.php`): V2 shows five counters "Jumlah", "Menunggu", "Disemak", "Diperbaiki", "Ditolak"; the PRD keeps **five** counters (verified on the live page); the state "Dikeluarkan" (set when the admin archives the question, `v2-question-bank.md` US-19/20) is a card badge and is counted under "Diperbaiki" so that the counters add up (FD-MUR-34). The five report statuses are exactly "Menunggu", "Disemak", "Diperbaiki", "Ditolak", "Dikeluarkan"; V2's legacy status "Selesai" is not a status in 1.0 and a stored legacy "selesai" shows as "Diperbaiki". Each report card: type chip (V2 labels "Duplikasi", "Soalan Kabur", "Salah Jawapan", "Kesalahan Taip"; for reports made with the V1 reason list the chip shows that reason's label), subject, question text (2 lines), optional comment, "Dihantar {d M Y}", status badge; empty 📋 "Tiada Laporan" / "Anda belum menghantar sebarang laporan soalan.". Newest first. US-20 adds the admin note and a once-only in-app notification when a report becomes "Diperbaiki".
  - Report dialog (V1 M05 S7): title "Lapor Soalan", "Sebab Laporan *" with checkboxes: MCQ "Jawapan tidak tepat", "Soalan mengelirukan", "Set jawapan tidak tepat", "Pilihan jawapan tidak lengkap", "Soalan berulang / pendua", "Kesalahan ejaan / taip", "Lain-lain"; structured: "Skema jawapan tidak tepat", "Soalan mengelirukan", "Markah tidak adil", "Kesalahan ejaan / taip", "Lain-lain" (`v2-question-bank.md` 4.7); "Komen Tambahan (pilihan)" (max 500, placeholder "Terangkan masalah soalan ini...", counter "{n}/500"); buttons "Batal", "Hantar Laporan" (disabled until a reason is chosen; "Menghantar..."); success "Terima Kasih!" / "Laporan berjaya dihantar."; failure "Gagal menghantar laporan. Sila cuba lagi." in an error state (V1 showed the success view, a defect, FD-MUR-28). V1 subtitle "Soalan ini akan dinyahaktifkan sementara" is wrong under D98 (FD-MUR-29).
  - **D98 rules**: a pupil may report only a question from their own attempt or practice session; a report never auto-deactivates a question; the admin decides in Laporan Soalan (Arkib/Tolak); a re-report never undoes an admin dismiss; a per-pupil daily cap applies. Soalan by Chapter has no lock.
- **Functional requirements**
  - FR-MUR-54-1 "Laporan Soalan" is a sidebar item and `/laporan-soalan` opens for a pupil (add to the scope list).
  - FR-MUR-54-2 The list shows only the pupil's own reports, newest first, with five counters "Jumlah", "Menunggu", "Disemak", "Diperbaiki", "Ditolak" where Jumlah equals the sum of the other four; a report whose question was removed (badge "Dikeluarkan") is counted under "Diperbaiki"; each counter equals the number of rows in its status.
  - FR-MUR-54-3 The only status labels are "Menunggu", "Disemak", "Diperbaiki", "Ditolak", "Dikeluarkan" (no "Selesai"); the status and admin note update on the next view.
  - FR-MUR-54-4 The dialog is reachable from every question card in Latih Tubi, Soalan by Chapter, Databank, Tracking A, Subjektif, Bijak (attempt and Semakan) and Remedial/Analisa Item drills, with the reason set for the question kind.
  - FR-MUR-54-5 The server accepts a report only for a question the pupil has answered or been served in their own attempt or session; otherwise 403.
  - FR-MUR-54-6 A report never changes the question's servability; one report per pupil per question version; a daily cap per pupil (20 per day, set by the backend, OQ-MUR-15) returns a plain BM message when reached.
  - FR-MUR-54-7 The dialog copy is exact as above; on network or server failure an error state shows with "Gagal menghantar laporan. Sila cuba lagi." and the typed text is kept.
  - FR-MUR-54-8 Report text and pupil identity are never sent to any AI service.
- **Data and dependencies**: reports (owner M04 `question-reports`: `POST`, `mine`, `PATCH`), admin Laporan Soalan queue (R1-ADM question reports, BS-05; cross-ref).
- **Acceptance criteria**
  - AC-MUR-54-1 Given a pupil with 5 reports (1 Menunggu, 1 Disemak, 1 Diperbaiki, 1 Ditolak, 1 Dikeluarkan), when `/laporan-soalan` opens, then the counters read Jumlah 5, Menunggu 1, Disemak 1, Diperbaiki 2, Ditolak 1, 5 cards show, and no badge reads "Selesai".
  - AC-MUR-54-2 Given an admin sets Diperbaiki with a note, when the pupil reloads, then the badge and note show.
  - AC-MUR-54-3 Given a pupil reports a question never served to them, then 403.
  - AC-MUR-54-4 Given the pupil reports a question, then the question still serves to other pupils until the admin archives it.
  - AC-MUR-54-5 Given a second report of the same version, then it is refused with a plain BM message.
  - AC-MUR-54-6 Given a 375x667 viewport and the report dialog opened with the on-screen keyboard active in the comment field, then the dialog width is at most 375 px, the live counter "{n}/500" and the "Hantar Laporan" button are both inside the visual viewport, and on `/laporan-soalan` the five counters wrap in rows of at most 3 without sideways scroll.
- **Current gap and root cause**: `prototype-scope.ts` STUDENT_ITEMS has no row 54; no menu entry (`user-nav.ts`); route exists (`m04 routes/my-reports.ts:11`).
- **Fidelity deviations**: FD-MUR-28, FD-MUR-29, FD-MUR-34. **Decisions applied**: OQ-MUR-4, OQ-MUR-15. (decided in section 6.1)

---

## 3B. Modules, the rest of the matrix (every other Murid row; same template and depth)

Rows A4 and 17-36, 38-40. Row 15 (Mohon Keluarga Angkat) and row 37 (Cikgu Alesa) stay hidden (D102) and have no section. Delivery starts after the 1.0 columns, except modules marked "1.0 (linked from R1-MUR-x)" (D106), which ship with 1.0. Each section below is a full requirement: when built, the module has no "Pratonton", no "akan datang", no "belum tersedia" stub, no prototype page, no mock data and no dead button (D100). Data-empty states (no records yet) are allowed and quoted per module.

Same template as section 3 (Action, Screen specification (from V2), change list). Only the listed gaps are changed; the existing screen, routes and API are reused (FR-X1-5).

### Common rules (apply to every module in 3B)
- FR-MUR-P2-1 Every screen reads and writes real data through the API (`VITE_API_MODE=http`); no in-browser mock, seed constant or hard-coded number reaches the pupil.
- FR-MUR-P2-2 Own data only; another pupil's id returns 403/404; shared lists show display name and public figures only (FR-MUR-8-2 rule).
- FR-MUR-P2-3 Every button and link does what its label says, or is not rendered; a control whose backend is not ready is not shipped.
- FR-MUR-P2-4 Forms and dialogs use BM messages for success, validation and error, keep typed input on error, and disable the submit button while sending.
- FR-MUR-P2-5 T1-T5 pupils (D101) and Darjah hidden (D72); layouts per 4.9 principles and X6.1 at 375/768/1280 px.
- AC-MUR-P2-1 Given a logged-in pupil and a seeded record for the module, when its menu item is opened, then the page returns HTTP 200 from the API with real data, no console error, and the page text contains none of "akan datang", "belum tersedia dalam prototaip", "Pratonton".
- AC-MUR-P2-2 Given pupils A and B with private records of the same module, when A requests B's record id, then the API answers 403 or 404 and A's page never contains B's record text.
- AC-MUR-P2-3 Given viewports 375x667, 768x1024 and 1280x800 and the module seeded with at least 3 records, when the page loads, then `document.documentElement.scrollWidth <= window.innerWidth` and the module's primary action button is within the viewport after at most one scroll (AC-X6-1).

### R1-MUR-A4 Tiket Bantuan
- **Action**: Complete (the list and form exist; the single admin reply "Balasan Sokongan" depends on API-SUP-05, which does not exist yet; OD-4 decided a single reply, no thread)
- **Screen specification (from V2)** (V2 route `/pusat-tuisyen/tiket`, also `/tiket`; title "Tiket Bantuan — PRESTASIPLUS"). Regions: (1) counter line "Jumlah tiket: {n}" and button "Tiket Baru" (opens the inline form below); (2) inline form headed "Tiket Baru" with fields "Subjek" and "Butiran" and button "Hantar Tiket" (field types, limits and success/error messages: Not observed in V2 — follow FR-MUR-A4-*); (3) status filter chips "Semua", "Dibuka", "Dalam Proses", "Menunggu Balas", "Selesai", "Ditutup"; (4) ticket list, empty state (observed) "Tiada tiket lagi." with button "Buat Tiket Pertama" (opens the same form). Populated rows and the ticket detail/reply page: Not observed in V2 — follow FR-MUR-A4-*. Loading and error: Not observed in V2 — follow FR-X6.
- **Corrections from the screens (earlier review)**: Corrections: the page shows "Jumlah tiket: {n}", a button "Tiket Baru" that opens an inline form with "Subjek", "Butiran" and "Hantar Tiket", the filters "Semua", "Dibuka", "Dalam Proses", "Menunggu Balas", "Selesai", "Ditutup", and the empty state "Tiada tiket lagi." with the button "Buat Tiket Pertama". A ticket with a thread is not in the screens (E-13).
- **Current gap and root cause**: V3 matches V2 for the list and form (add the empty-state button "Buat Tiket Pertama" if absent). Missing: the admin reply and status change (API-SUP-05, R1-ADM-P2-20.2), so `adminReply` is always null today; show the reply under "Balasan Sokongan" once it exists.
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Tiket Baru | button; opens the inline form | - | form hidden | - | - | - | - | - |
  | Subjek | text, counter `{n}/255` | Ya | empty | trimmed; NUL characters refused | `Subjek diperlukan.`; `Subjek tidak boleh melebihi 255 aksara.` | - | `subject` | API-SUP-01 family (`POST /api/tiket`) |
  | Butiran | textarea, 6 rows | Ya | empty | trimmed | `Butiran diperlukan.`; `Butiran tidak boleh melebihi 5000 aksara.` | - | `body` | same |
  | Hantar Tiket | button | - | - | "Menghantar..." while sending | success flash `Tiket dihantar. Pasukan sokongan akan membalas secepat mungkin.`; the new row is first with status "Dibuka"; the form closes and clears; 429 per ERR-RATE-01 | Subjek, Butiran | ticket row | same |
  | Status filter chips | chips with counts | - | Semua | OPT-STATUS-TIKET: Semua, Dibuka, Dalam Proses, Menunggu Balas, Selesai, Ditutup; an unknown value is treated as Semua | - | - | query `status` | API-SUP-01 |
  - Behaviour: there is no attachment, no category and no reply box for the pupil (K15); the list is newest first, all own tickets, not paged; `meta.total` counts all own tickets whatever the filter. State machine `dibuka` -> `dalam_proses` -> `menunggu_balas` -> `selesai` -> `ditutup`, changed only by the admin (API-SUP-05); the admin saves a single reply text and the pupil sees it under "Balasan Sokongan" with the status label; the pupil cannot reopen (opens a new ticket). Hidden from the account menu and the sidebar in 1.0.
  - New requirements: FR-MUR-A4-6 The form follows K15 exactly (limits 255 and 5000, the messages above, no attachment). FR-MUR-A4-7 The pupil sees the single admin reply under "Balasan Sokongan".
  - New acceptance criteria: AC-MUR-A4-6 Given a Subjek of 256 characters, then `Subjek tidak boleh melebihi 255 aksara.` shows and the typed text stays. AC-MUR-A4-7 Given a created ticket, then it is first in the list with the status "Dibuka" and the flash above.
- **Name**: "Tiket Bantuan" (heading "Tiket Bantuan"; new ticket "Tiket Bantuan Baharu"). **Route**: `/pusat-tuisyen/tiket`, `/pusat-tuisyen/tiket/baru`, ticket detail. **Row**: A4. **Priority**: P2.
- **Current status**: V3 GH/UAT built like V2, 1 sample ticket; hidden from the 1.0 menu until now.
- **Outcome**: ask for help and follow the answer.
- **Reference (V2 `pusat-tuisyen-tiket*.blade.php`, M22)**: list filtered by status "Semua", "Dibuka", "Dalam Proses", "Menunggu Balas", "Selesai", "Ditutup"; button "Tiket Baru"; form with subject and message (V1 also had a category and a thread; not in R1, OD-4); the staff reply shows under "Balasan Sokongan".
- **FRs**: FR-MUR-A4-1 list shows only own tickets with the six status filters and counts. FR-MUR-A4-2 "Tiket Baru" creates a ticket with "Subjek" and "Butiran" (no category in R1; limits 255 and 5000 shown) and shows it in the list as "Dibuka". FR-MUR-A4-3 the ticket shows the single admin reply under "Balasan Sokongan" and its current status; the pupil cannot reply (to add information the pupil opens a new ticket), as OD-4 decided. FR-MUR-A4-4 a pupil cannot read another pupil's ticket. FR-MUR-A4-5 empty list shows an empty-state line with the "Tiket Baru" button.
- **Data and dependencies**: tickets (owner M22); admin feed: admin Tiket inbox (cross-ref admin PRD); API `tiket`.
- **ACs**: AC-MUR-A4-1 Given a new ticket, then it appears under "Dibuka" and "Semua". AC-MUR-A4-2 Given the admin saves a reply and a status (R1-ADM-P2-20.2), then on reload the pupil's ticket shows the reply under "Balasan Sokongan", the new status label, and no reply box. AC-MUR-A4-3 Given another pupil's ticket id, then 404 (the list is own-only and there is no cross-user detail route; section 1.7 default). AC-MUR-A4-5 Given the pupil submits a ticket, then the admin ticket list shows it with the role "Murid" and the pupil's school, and the same ticket appears in the pupil's list with the admin reply once saved (AC-CHAIN-7). AC-MUR-A4-4 Given 375 px, then the form is one column and the keyboard does not hide "Hantar".
- **Gap**: admin reply and status (API-SUP-05). **FD**: none. **OQ**: none (OD-4 decided).

### R1-MUR-17 Soalan Berstruktur
- **Action**: Complete
- **Screen specification (from V2)** (V2 route `/latihan-berstruktur`, title "Soalan Berstruktur — PRESTASIPLUS"). Regions: (1) heading "Soalan Berstruktur", sub "Latih tubi format Kertas 2 — jawab & semak secara automatik"; (2) filter bar: select "Subjek" ("Semua Subjek" then 31 subjects), select "Aras KBAT" ("Semua", "HOTS 4", "HOTS 5", "HOTS 6", "LOTS 1", "LOTS 2", "MOTS 3"; V3 orders them LOTS 1 to HOTS 6), search box with button "Cari"; (3) card grid, each card: subject name, chip "KBAT" (when applicable), duration chip (e.g. "10m"), level chip (e.g. "Tingkatan 5"), the first lines of the stimulus text cut with "...", "{n} bahagian · {m} markah", "{k} soalan · Tingkatan {x}", button "Mula" (opens the answer screen of 4.6). Empty text "Tiada soalan berstruktur ditemui" comes from the reference behaviour, not the capture. The answer screen and result: Not observed in V2 (submit forbidden) — follow section 4.6 and FR-MUR-17-*. Loading and error: Not observed in V2 — follow FR-X6.
- **Corrections from the screens (earlier review)**: Corrections: subtitle "Latih tubi format Kertas 2 — jawab & semak secara automatik"; filter "Subjek" (Semua Subjek + 31 subjects), "Aras KBAT" ("Semua", "LOTS 1", "LOTS 2", "MOTS 3", "HOTS 4", "HOTS 5", "HOTS 6"), search "Cari"; card: subject, "KBAT", "10m", "Tingkatan 5", the passage excerpt, "4 bahagian · 10 markah", "4 soalan", "Mula". **V2 differs**: V2 puts the whole passage inside the first question text (a passage as a question); PRD follows D90 (passage = stimulus shown once above its questions). The answer page is not in the screens (E-17).
- **Current gap and root cause (change list; reuse the page and `practice/structured`)**: answering per 4.6 (parts tree, working mode, autosave), real content (3 seed sets), stimulus shown once.
- **End-to-end flow**: see 46 section 4.6 (B5 Subjektif, Soalan Berstruktur) with 2.2 (item kinds), 3 (marking) and 3.4 (self-mark). This block keeps only the fields specific to the module.
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Subjek | select | Tidak | "Semua Subjek" | subjects that have a published structured set, name asc | - | - | query `subjectId` | API-PRAC-10 |
  | Aras KBAT | select | Tidak | "Semua" | OPT-ARAS-KBAT: LOTS 1, LOTS 2, MOTS 3, HOTS 4, HOTS 5, HOTS 6 (`kbatLevel` = the Aras index in OPT-ARAS order: Mengingat 1, Memahami 2, Mengaplikasi 3, Menganalisis 4, Menilai 5, Mencipta 6; KBAT = Aras 3 to 6, so the badge KBAT shows for 3 to 6); never the Bloom leaf level (K14) | - | - | query `aras` | same |
  | Cari | text + button | Tidak | empty | stem or stimulus text, max 100 characters | none found: `Tiada soalan berstruktur ditemui` / `Tiada soalan sepadan dengan tapisan anda. Cuba tapisan lain.` | - | query `q` | same |
  | Cards | list | - | - | 12 per page, newest published first, pager "Sebelum" / "Seterusnya" | - | - | - | same |
  | Hantar & Semak | button | - | - | dialog B-056d only when a leaf is blank | see 13 | - | rows of mode `structured` | API-PRAC-10 |
  - Behaviour: answers are stored with mode `structured` (a Tracking A Bahasa set uses `tracking_a`); the earlier values `spm_mock` and `spm_ramalan` are replaced by the 19 values of 50 section 4.7a. FR-MUR-17-3 is read with that change. Objective parts include `true_false` and `mcq_multi` (served here, not in single-option drills).
  - New requirements: FR-MUR-17-6 Rows written by Soalan Berstruktur carry `mode = structured`. FR-MUR-17-7 The Aras filter is the integer 1-6 vocabulary only.
  - New acceptance criteria: AC-MUR-17-5 Given a pupil submits a structured set, then its rows in `practice_answers` have mode `structured` and none has `spm_mock` or `spm_ramalan`.
- **Name**: "Soalan Berstruktur" (sub "Latih tubi format Kertas 2"; Bahasa lane "Tracking A Bahasa" / "BM dan BI ikut format kertas sebenar"). **Route**: `/latihan-berstruktur`, `/latihan-berstruktur/:id`, `/latihan-berstruktur/keputusan/:attempt`. **Row**: 17. **Priority**: P1. **Delivery**: 1.0 (linked from R1-MUR-13).
- **Current status**: V3 built (3 seed sets, filters Subjek, Aras KBAT, Cari); UAT same; also the answer screen of SPM > Subjektif.
- **Outcome**: practise Kertas 2 style structured questions with scheme and self-mark.
- **Reference (V2 mechanism 2.4 for flow and copy; answering per 4.6)**: list with filters "Semua Subjek", "Aras KBAT" (HOTS/MOTS/LOTS), search; cards with best score, "{n} markah", "Mula" or "Cuba Lagi"; notice "{n} soalan untuk pilihan ini masih menunggu skema pemarkahan..."; empty "Tiada soalan berstruktur ditemui" / "Tiada soalan sepadan dengan tapisan anda. Cuba tapisan lain."; answer page "Soalan Berstruktur — Jawab", "{n} bahagian · {m} markah", "✍️ Tulis jawapan anda, kemudian tekan Hantar & Semak.", per part input, "Hantar & Semak" ("Menyemak…"), "Skema Pemarkahan:", "Jalan Kerja / Skema:", "Hantar Jawapan"; result page.
- **FRs**: FR-MUR-17-1 only approved structured questions with a usable scheme are listed (`markable`). FR-MUR-17-2 the answer screen follows 4.6 (parts tree, modes, working with final answer, autosave; the legacy 3-row textarea without autosave is not used, FD-MUR-22). FR-MUR-17-3 after "Hantar & Semak" the scheme and per-point hit or miss show and the pupil self-marks; the score is recorded once with mode `structured` (a Tracking A Bahasa set: `tracking_a`). FR-MUR-17-4 KBAT filter maps 1-2 LOTS, 3 MOTS, 4-6 HOTS badges as in V1. FR-MUR-17-5 Rewards per 4.4.
- **Data**: structured questions (owner M04), attempts (M05); admin Kertas/Subjektif authoring (cross-ref). API `practice/structured`.
- **ACs**: AC-MUR-17-1 Given a structured question with 3 parts, then 3 inputs matching their modes show with marks and a total equal to the sum. AC-MUR-17-2 Given a refresh mid-answer, then the typed answers are restored. AC-MUR-17-3 Given submit, then the scheme shows only after submit and self-mark updates the score. AC-MUR-17-4 Given a 375x667 viewport and a structured question with 3 parts, when the pupil focuses the third part's input and the on-screen keyboard opens, then the focused input and the "Hantar & Semak" button are both inside the visual viewport, each input's width is at least 90% of its card's width, and `scrollWidth <= innerWidth`.
- **Gap**: seed data only (3 sets); UAT structured content missing. **FD**: FD-MUR-22. **Decided**: none needed.

### R1-MUR-18 Kedudukan
- **Action**: Fix
- **Screen specification (from V2)** (route `/ranking`, browser title "Kedudukan — PRESTASIPLUS"; the rank figures in V2 depend on the pupil's coins, so they are written as placeholders). Regions: (1) top line "Syiling anda" with the coin value, and the note "Kedudukan dikira berdasarkan baki syiling."; (2) three rank cards in a row: "Dalam sekolah", "Dalam negeri", "Kebangsaan" (a class card appears only for a pupil in a class); each shows "#{rank}", "/ {total}" and "Kumpulan {p}% teratas" where p = round(rank / total x 100) (checked on two pupils: 175/342 gives 51); (3) section "Sekitar anda" with the sub-label "Dalam sekolah": four rows showing the neighbours around the pupil (avatar initials, pupil name, coins); the pupil's own row carries the marker "ANDA"; (4) link "Lihat papan pendahulu penuh" (opens Papan Pendahulu, R1-MUR-33). Empty and error states: Not observed in V2 — follow FR-MUR-18-* and FR-X6. V2 shows names of other pupils in "Sekitar anda": V3 shows the same only as allowed by FR-MUR-18-* and the privacy rules (initials or display name per the Papan Pendahulu rule).
- **Corrections from the screens (earlier review)**: the screens replace my earlier text: the page starts "Syiling anda {n}" and "Kedudukan dikira berdasarkan baki syiling."; one card per applicable scope, titled "Dalam sekolah", "Dalam negeri", "Kebangsaan" (the class card appears only for a pupil in a class), each "#{rank}" "/ {total}" and "Kumpulan {p}% teratas" where p = round(rank / total x 100) (e.g. 406/864 = 47, 1,800/4,296 = 42, 2,141/4,806 = 45); "Sekitar anda" with a sub-heading per scope and rows "initials, name, syiling" with the own row marked "ANDA"; link "Lihat papan pendahulu penuh". V2 has no Skop/Subjek/Tingkatan filters; the empty-pool copy "Kedudukan belum tersedia" / "Akaun anda belum dikaitkan dengan sekolah atau kelas." is from the V2 view.
- **Current gap and root cause (change list; reuse `RankingPage.vue`, `rankings` API)**: show the own-rank cards and "Sekitar anda" (today an empty list "Tiada data kedudukan"); compute ranks from wallet syiling by the order of 48 GAME-16; the V3 filters are removed.
- **Field & behaviour spec** (read only)
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Own-rank cards (Kelas if in a class, Sekolah, Negeri, Kebangsaan) | read-only | - | the V2 sentence `Kedudukan belum tersedia` (kept) when there is no data | rank = 1 + number of pupils in the pool ordered before the pupil by the tie-break chain of 48 GAME-16 (distinct positions, no shared rank); percentile p = round half up(rank / total x 100); text "Kumpulan {p}% teratas"; live | - | - | - | rank read |
  | Sekitar anda | list | - | - | up to 2 pupils above, the pupil's own row marked "ANDA", up to 2 below in the same order (5 rows at most; fewer at the top or bottom) (K10); others by first name only | - | - | - | same |
  - Behaviour: the V3-only filters Skop, Subjek and Tingkatan are removed (V2 has none; the cards give the scopes). Reads the Syiling balance, so a pupil with coins never sees "Tiada data kedudukan". Same data as GAME-16.
  - New requirements: FR-MUR-18-6 The Skop/Subjek/Tingkatan selects are not rendered. FR-MUR-18-7 Other pupils show a first name only, no school.
  - New acceptance criteria: AC-MUR-18-5 Given the pupil is rank 1, then "Sekitar anda" shows the own row and 2 below (3 rows).
- **Name**: "Kedudukan" (sub "Di mana anda berdiri — dalam kelas, sekolah, negeri dan seluruh negara"). **Route**: `/ranking`. **Row**: 18. **Priority**: P1. **Delivery**: 1.0 (linked from R1-MUR-33).
- **Current status**: V3 GH/UAT: filters Skop/Subjek/Tingkatan and "Tiada data kedudukan" although the pupil has coins; no own-rank card.
- **Outcome**: see own standing.
- **Reference (V2 `ranking.blade.php`, `StudentExtrasController::ranking`; V1 M08 `/ranking`)**: own-rank card per scope (class, school, state, national): "#{rank}/{total}", group text such as "Kumpulan {n}% teratas"; "Sekitar anda" lists the pupils just above and below; link to the full board (Papan Pendahulu); V1 filters Nasional/Negeri/Daerah/Sekolah, Subjek, Tingkatan. Rank = 1 + number of pupils in the pool ordered before the pupil by the GAME-16 chain (a lone pupil is 1 of 1). Scopes that do not apply are skipped. Empty: "Kedudukan belum tersedia" / "Akaun anda belum dikaitkan dengan sekolah atau kelas."; "Tiada pelajar lain untuk dibandingkan dalam skop ini."
- **FRs**: FR-MUR-18-1 own-rank card per applicable scope with rank, total and percentile group. FR-MUR-18-2 "Sekitar anda" shows up to 2 above and 2 below with the display name (first name only, section 4.3; V2 printed names) and syiling (no other data, no school). FR-MUR-18-3 ranks are computed live from wallet syiling and agree with Papan Pendahulu and Kelas Saya order. FR-MUR-18-4 V2 has no Skop/Subjek/Tingkatan filters (V2 route `/ranking`); the cards are "Dalam sekolah", "Dalam negeri", "Kebangsaan" (and the class card when the pupil is in a class) and the group text is "Kumpulan {p}% teratas" with p = round(rank / total x 100); the V3 filters Skop, Subjek and Tingkatan are not rendered (FR-MUR-18-6). FR-MUR-18-5 a pupil with coins never sees "Tiada data kedudukan".
- **Data**: wallets (M14), school/class (M01/M10). API `rankings`.
- **ACs**: AC-MUR-18-1 Given a pupil with 374 coins in a school of 864, then the school card shows the correct rank and "Kumpulan {n}% teratas". AC-MUR-18-2 Given a lone pupil, then "#1/1". AC-MUR-18-3 Given a pupil without school, then only applicable scopes show with the V2 message. AC-MUR-18-4 Given 375 px, then cards stack and the nearby list wraps.
- **Gap**: ranking not computed for demo pupil (parity gap 10). **FD**: none. **Decided**: none needed.

### R1-MUR-19 PKSK
- **Action**: Complete
- **Screen specification (from V2)** (route `/pksk`, browser title "PKSK PRO — PRESTASIPLUS"). Observed for a pupil without access. Regions: (1) no-access banner "Anda belum mempunyai akses PKSK PRO" / "Akses PKSK diberikan oleh pentadbir sekolah anda. Hubungi guru atau pentadbir sekolah untuk mengaktifkan pakej."; (2) three stat tiles "Jumlah soalan", "Bahagian", "Domain" (V2: 748, 3, 12); (3) block "Soalan mengikut Bahagian" with rows "Bahagian A", "Bahagian B", "Bahagian C" and a count each; (4) block "Domain teratas": 12 rows, domain name and "{n} soalan" (e.g. "Kecerdasan Insaniah", "Bahasa Inggeris", "Matematik", "Sains", "Sejarah Malaysia", "Geografi", "Sukan & Pencapaian", "Alam Sekitar", "Teknologi & IT", "Kebudayaan Kaum", "Ekonomi Malaysia", "Inovasi & Pencipta"); (5) block "Pakej PKSK" with "Pakej ini diaktifkan oleh pentadbir sekolah anda." and a list of packages with price: "PKSK Tingkatan 1 (SBP/MRSM)" RM0.00, "PKSK Tingkatan 4 (SBP/MRSM)" RM0.00, "PKSK Kombo (T1 + T4)" RM0.00, "PKSK Asas" RM39.00, "PKSK Premium" RM79.00. No buttons in the no-access state. The accessible state (practice start, history): Not observed in V2 — follow FR-MUR-19-*. Loading and error: Not observed in V2 — follow FR-X6.
- **Exact copy of the no-access state (earlier review)**: "Anda belum mempunyai akses PKSK PRO" / "Akses PKSK diberikan oleh pentadbir sekolah anda. Hubungi guru atau pentadbir sekolah untuk mengaktifkan pakej."; tiles "Jumlah soalan 748", "Bahagian 3", "Domain 12"; "Soalan mengikut Bahagian" (Bahagian A 147, B 571, C 30); "Domain teratas" (Kecerdasan Insaniah 147, Bahasa Inggeris 54, Matematik 54, Sains 54, Sejarah Malaysia 51, ... 12 rows); "Pakej PKSK" / "Pakej ini diaktifkan oleh pentadbir sekolah anda." with five packages and prices (PKSK Tingkatan 1 (SBP/MRSM) RM0.00, Tingkatan 4 RM0.00, Kombo RM0.00, Asas RM39.00, Premium RM79.00). The answering flow with a grant is not in the screens (E-12).
- **Current gap and root cause (change list; reuse the page and `pksk/*`)**: add the answer flow and result (V2 lists only); show the "Pakej PKSK" block; enforce grant expiry.
- **End-to-end flow**: see 46 section 4.12 (D6 PKSK, same drill engine). This block keeps the module fields.
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Bahagian A / B / C cards | cards | - | - | start a set of 10 questions | no access: the V2 banner `Anda belum mempunyai akses PKSK PRO` with the exact sub-text of the screen specification | access | rows of mode `pksk` | API-PRAC-12 |
  | Domain cards (top 12) | cards | - | - | a domain card starts a set of 10 questions (`PRACTICE_SIZE = 10`, D115: one set size everywhere; the earlier "5" is dropped) | - | - | same | same |
  - Behaviour: access follows the pupil's PKSK entitlement; a pupil without it sees the banner and no start button. Answers are stored with mode `pksk`. "PRO" badge in the sidebar.
  - New requirements: FR-MUR-19-7 **(D115, D114(a), matrix-audit MX-3)** Practice set size is 10 questions for a Bahagian (A, B or C) and for a domain, equal to V3's `PRACTICE_SIZE = 10` (`apps/api/src/modules/pksk/pksk.constants.ts:38`, BR-M07-25); this replaces the earlier 10 versus 5 conflict with 46 (46 section 4.12 D6 now says 10). V2 has no practice or answering flow, so the function comes from V1 M07 and from what V3 already built from it; V2 supplies only the `/pksk` screen above. **V1 parts kept because V2 lacks the function (all already built in V3: Verify, no rebuild):** level hub with T1/T4 cards and "Format Peperiksaan" (A 30 "Kecerdasan Insaniah" 20%, B 70 "Kecerdasan Intelek" 70%, C 1 esei "Artikulasi Penulisan" 10%; `src/modules/m07-pksk/pages/PkskHubPage.vue`, `PkskDashboardPage.vue`), level dashboard with readiness score and grade, domain list and domain practice (`PkskDomainsPage.vue`, `PkskPracticePage.vue`), full exam `PkskExamPage.vue` scored server side over the planned counts 30/70/1 (`pksk-student.service.ts:196`, `EXAM_PLAN` in `pksk.constants.ts:31-35`), history `PkskHistoryPage.vue`; routes `src/modules/m07-pksk/routes/student.ts:22-56`. Not changed in R1. Marking: A and B are auto-marked from the key; C (essay) is marked by the existing server rule of `pksk-student.service.ts` (read it in the gap check; the V1 note says the essay is marked by the simulated marker). The V2 `/pksk` page (no-access state and counts) is the pupil's landing for a pupil without a grant; with a grant the V3 hub shows (V3 layout kept, FR-X1-6). Access is granted by Admin Pusat on `/admin/pksk/access` (30 R1-ADM-Q-26). FR-MUR-19-8 Rows carry mode `pksk`.
  - New acceptance criteria: AC-MUR-19-5 Given a domain card is started with at least 10 approved questions, then 10 questions are served and 10 rows of mode `pksk` exist after the checks.
- **Name**: "PKSK" (page "PKSK PRO", sub "Bank soalan Pentaksiran Kompetensi & Sijil Kemahiran"; V3 title "Persediaan Kemasukan"; badge "PRO"). **Route**: `/pksk`. **Row**: 19. **Priority**: P1.
- **Current status**: GH/UAT open (AKTIF T1/T4, format A/B/C); V2 locked without access, 748 questions, 3 Bahagian, 12 domains. V2 lists only; the answering flow was not found (D100: a listing-only page is a stub).
- **Outcome**: practise PKSK questions per Bahagian and domain with an access grant.
- **Reference (V2 `pksk.blade.php`, mechanism 2.14; V1 M07)**: counts per "Soalan mengikut Bahagian" and domain (top 12) always shown; question list only with an active grant; no grant: "Anda belum mempunyai akses PKSK PRO" with how to get access; cards "BAHAGIAN {n}" and domain.
- **FRs**: FR-MUR-19-1 without an active grant the page shows the exact notice "Anda belum mempunyai akses PKSK PRO" / "Akses PKSK diberikan oleh pentadbir sekolah anda. Hubungi guru atau pentadbir sekolah untuk mengaktifkan pakej.", the three tiles, "Soalan mengikut Bahagian", "Domain teratas" and "Pakej PKSK", and no question text. FR-MUR-19-2 with a grant the pupil can open and answer questions (A/B/C formats per V1 M07) with a result and session record (the V2 listing-only page is completed, FD-MUR-31). FR-MUR-19-3 grant expiry blocks answering at once. FR-MUR-19-4 only approved PKSK questions are served; counts per D91. FR-MUR-19-5 questions render per 4.6. FR-MUR-19-6 school-level access message when the school (not the pupil) holds the grant.
- **Data**: PKSK questions and grants (owner M07); admin PKSK soalan and akses (cross-ref admin PRD). API `pksk/*`.
- **ACs**: AC-MUR-19-1 Given no grant, then the message shows and no question text is in the response. AC-MUR-19-2 Given a pupil with an active grant and a test bank of 12 approved PKSK questions in Bahagian A, when the pupil opens a set of 10 and answers all, then the server returns a result "{betul}/10" equal to the number of correct answers in the key, a practice session of mode `pksk` with 10 questions is stored, and the result appears in the pupil's Prestasi session count. AC-MUR-19-3 Given an expired grant, then answering is refused with a BM message. AC-MUR-19-4 Given 375 px, then Bahagian cards stack and options are full-width.
- **Gap**: V2 has no answer flow; V3 format built (parity). **FD**: FD-MUR-31. **Decided**: OQ-MUR-16 (section 6.1).

### R1-MUR-20 Artikel
- **Action**: Keep
- **Screen specification (from V2)** (route `/artikel`, browser title "Artikel — PRESTASIPLUS"; detail `/artikel/{slug}`, title "{article title} — PRESTASIPLUS"). List regions: (1) search box (placeholder "Cari"); (2) category pills "Semua", "Berita", "Kejayaan", "Motivasi", "Panduan Guru", "Panduan Ibu Bapa", "Tips Belajar", "Umum"; (3) card grid, each card: cover image, category in capitals (e.g. "MOTIVASI"), date (e.g. "22 Feb 2026"), title, "{n} bacaan"; a card opens the detail page. Detail regions: link "Semua artikel" (back to the list), category chip in capitals, title, date (V2 prints "21 February 2026" in English: defect, V3 prints the month in BM), "{n} bacaan", article body (text not captured: follow FR-MUR-20-*), block "Artikel berkaitan" with four rows (title, short date). V2 appends an author credit to some titles ("Oleh: {author}"): V3 shows no person names in titles (privacy). Empty state, pager and error: Not observed in V2 — follow FR-MUR-20-* and FR-X6.
- **Confirmed in the screens (earlier review)**: Confirmed: search "Cari", pills "Semua", "Berita", "Kejayaan", "Motivasi", "Panduan Guru", "Panduan Ibu Bapa", "Tips Belajar", "Umum"; card: category in capitals, date "22 Feb 2026", title, "{n} bacaan" (read count).
- **Current gap and root cause**: None. Verify the ACs only (add "{n} bacaan" if V3 shows another counter).
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Cari | text | Tidak | empty | max 100 characters; title and body | none found: the empty copy of the screen specification | - | query `q` | articles read |
  | Category pills | chips | Tidak | Semua | OPT-KATEGORI-ARTIKEL (Semua, Berita, Kejayaan, Motivasi, Panduan Guru, Panduan Ibu Bapa, Tips Belajar, Umum); a pill with 0 is disabled | - | - | query `kategori` | same |
  | Pager | buttons | - | 12 per page, newest first | "Sebelum" / "Seterusnya" | - | - | query `halaman` | same |
  - New requirements: FR-MUR-20-5 Search is capped at 100 characters and filters reset the page to 1. FR-MUR-20-6 An unpublished slug answers ERR-ACC-02.
  - New acceptance criteria: AC-MUR-20-4 Given 25 articles, then page 1 shows 12 and page 3 shows 1.
- **Name**: "Artikel" (reader "Artikel"). **Route**: `/artikel`, `/artikel/:slug`. **Row**: 20. **Priority**: P1. **Delivery**: 1.0 (linked from R1-MUR-2).
- **Current status**: V3 matches V2 plus "Paling Hangat".
- **Outcome**: read curated articles.
- **Reference (V1 M09 S15-S16, V2)**: search; category pills "Semua", "Tips Belajar", "Berita", "Motivasi", "Panduan Ibu Bapa", "Panduan Guru", "Kejayaan", "Umum"; grid with title, category chip, relative date; reader with title, category, date, body; the Dashboard rail links here.
- **FRs**: FR-MUR-20-1 only published articles are listed, newest first, paged. FR-MUR-20-2 search and category pills combine and keep state across paging; a zero-count pill is disabled. FR-MUR-20-3 the reader shows the full body safely (no raw HTML injection) and a back link. FR-MUR-20-4 "Paling Hangat" (V3 addition) is kept only if it is computed from real views.
- **Data**: articles (owner M09); admin Artikel screen (cross-ref).
- **ACs**: AC-MUR-20-1 Given a category with 2 articles, then the pill shows 2 and the list 2. AC-MUR-20-2 Given an unpublished article id, then 404. AC-MUR-20-3 Given 375 px, then the grid is one column and pills scroll.
- **Gap**: none. **FD**: none. **Decided**: none needed.

### R1-MUR-22 Cabutan Bertuah
- **Action**: Complete
- **Screen specification (from V2)** (route `/cabutan`, browser title "Cabutan Bertuah — PRESTASIPLUS"). Regions: (1) heading "🎟️ Cabutan Bertuah", sub "Guna syiling untuk beli tiket & menangi hadiah hebat!", coin line "Syiling anda" with "{n} 🪙"; (2) section "Cabutan Dibuka" listing open draws; empty state (observed) "Tiada cabutan dibuka buat masa ini. Nanti datang lagi! 🎈". Populated draw card (prize, ticket price, buy button; V2 shows a disabled button "Pembelian tiket belum tersedia", which V3 replaces with a working purchase per D100) and results of closed draws: Not observed in V2 — follow FR-MUR-22-*. Loading and error: Not observed in V2 — follow FR-X6.
- **Confirmed in the screens (earlier review)**: Confirmed: heading "🎟️ Cabutan Bertuah", "Guna syiling untuk beli tiket & menangi hadiah hebat!", "Syiling anda {n} 🪙", section "Cabutan Dibuka" and the empty "Tiada cabutan dibuka buat masa ini. Nanti datang lagi! 🎈". A populated draw (and the V2 disabled button "Pembelian tiket belum tersedia") is not in the screens (E-12).
- **Current gap and root cause (change list; reuse the page)**: replace the demo draw by real draws; make "Beli Tiket" real (wallet debit, limit); admin draw management is missing (cross-ref admin PRD).
- **End-to-end flow**: see 48 GAME-22 (Cabutan Bertuah).
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Beli Tiket | button, one ticket per press | - | - | dialog B-056a: title `Beli tiket cabutan?`, body `{harga} syiling akan ditolak daripada baki anda ({baki} syiling).`, buttons "Beli Tiket" / "Batal" | 409 `Baki syiling tidak mencukupi.` (ERR-WAL-01); 409 `Had tiket dicapai.` (ERR-RWD-05); 409 `Cabutan ditutup.` (ERR-RWD-04) | draw open | ticket + wallet debit once per press (idempotency key) | rewards API (48 GAME-22) |
  - Behaviour: the maximum tickets per pupil is the draw's field `draw_max_tickets_per_pupil` (default 10); winners are shown by first name only.
  - New requirements: FR-MUR-22-6 The purchase debits once per press and is refused when short. 
  - New acceptance criteria: AC-MUR-22-5 Given a double press, then one ticket is bought and the balance falls once.
- **Name**: "Cabutan Bertuah" (sub "Guna syiling, menangi hadiah"). **Route**: `/cabutan`. **Row**: 22. **Priority**: P1.
- **Current status**: V3 shows a demo draw "Cabutan Demo" and "Beli Tiket" (50 syiling, 0/10); V2 shows "Tiada cabutan dibuka buat masa ini. Nanti datang lagi! 🎈" and a disabled button titled "Pembelian tiket belum tersedia" (a V2 stub).
- **Outcome**: spend coins on draw tickets for a prize.
- **Reference**: open draws list with prize, ticket price (syiling), max tickets per pupil, close date, own tickets; "Beli Tiket"; a winner is drawn at close and shown; past draws.
- **FRs**: FR-MUR-22-1 lists real open draws; no demo draw reaches production. FR-MUR-22-2 "Beli Tiket" debits the exact price from the wallet once, enforces the per-pupil limit and balance (message when short), and shows the updated count. FR-MUR-22-3 closed draws show the winner as display name or "Anda menang!" for the pupil, and past draws are listed. FR-MUR-22-4 empty state "Tiada cabutan dibuka buat masa ini. Nanti datang lagi! 🎈". FR-MUR-22-5 purchases are recorded in transactions (Syiling & Token).
- **Data**: draws, tickets (owner M15), wallet (M14); admin Cabutan screen (missing in V3 admin, cross-ref admin PRD).
- **ACs**: AC-MUR-22-1 Given a draw at 50 syiling and a pupil with 120, then buying 1 ticket leaves 70 and shows "1/10". AC-MUR-22-2 Given insufficient coins, then purchase is refused with a BM message and nothing is debited. AC-MUR-22-3 Given a double click, then one ticket only. AC-MUR-22-4 Given 375 px, then the buy button is full width.
- **Gap**: no admin draw management; demo data. **FD**: FD-MUR-32 (working purchase, V2 stub). **Decided**: none needed.

### R1-MUR-23 Tournament
- **Action**: Complete
- **Screen specification (from V2)**: none. V2 `/tournament` redirects the pupil to the Dashboard, so no pupil Tournament screen exists in V2. Route, title, regions, labels, buttons and states are Not observed in V2 — follow FR-MUR-23-* and the V1 structure below. The only V2 pupil-side trace is the competition banner in the shell (FR-MUR-SH-12). The PRD takes the structure from V1 `docs/discovery/M16-battle-games.md` (see E-14). V2 shows no Liga/Tournament screen, so V3's page is kept as the base.
- **Current gap and root cause (change list; reuse the existing "Liga & Tournament" page)**: real leagues from the API; standings (no pupil join, D-GAME-3); shell banner when active; admin creation is missing (cross-ref admin PRD).
- **End-to-end flow**: see 48 GAME-15 (Liga and Tournament).
- **Field & behaviour spec** (read only for the pupil)
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | League/tournament list, standings | read-only | - | `Tiada liga atau tournament buat masa ini.` | the leagues the pupil's school is enrolled in; enrolment is done by Admin Pusat only (no Guru/AS menu, D113); formats `single_match` and `league` only (48 D-GAME-4) | - | school enrolment | - | 48 GAME-15 |
  | Shell banner | link | - | not rendered | rendered only when a tournament is active; opens `/tournament` | - | - | - | - |
  - New requirements: FR-MUR-23-5 There is no pupil or teacher control to join a league: enrolment is by Admin Pusat. 
  - New acceptance criteria: AC-MUR-23-4 Given a school not enrolled, then the list shows `Tiada liga atau tournament buat masa ini.`.
- **Name**: "Tournament" (page "Liga & Tournament"). **Route**: `/tournament` (canonical; it hosts both tabs "Liga" and "Tournament", 48 GAME-15), `/liga` redirects to `/tournament?tab=liga`; a round is played on `/tournament/:uuid/round/:n` (page `TournamentRoundPage.vue`). **Row**: 23. **Priority**: P2 in the matrix; delivered in 1.0 by card S7-T06. **Delivery**: 1.0 (linked from the shell tournament banner, R1-MUR-SH).
- **Current status**: V3 page exists, empty; V2 redirects pupils to Dashboard (teacher surface); V1 M16 has Liga/Tournament.
- **Outcome**: see the standings of the competitions the school is enrolled in.
- **Reference (V1 M16)**: list of open leagues (V1 had a "Sertai Liga Ini" button; removed in R1, D-GAME-3), standings per league, tournament banner on the shell when active; empty state "Tiada liga atau tournament buat masa ini." (copy decided by D113).
- **FRs**: FR-MUR-23-1 lists real leagues and tournaments with status, dates and own standing. FR-MUR-23-2 there is no "Sertai" control for a pupil (D-GAME-3): the school is enrolled by Admin Pusat, and the pupil sees own rank and the top rows of every league the school is in. FR-MUR-23-3 scoring uses real practice or game results of the period only. FR-MUR-23-4 the shell banner shows only an active tournament and links to it.
- **Data**: leagues (owner M16); admin Tournament screen missing (cross-ref).
- **ACs**: AC-MUR-23-1 Given an open league the pupil's school is enrolled in, then the page shows no "Sertai" control and the pupil appears in the standings with own rank (48 AC-GM-15.1 proves the scoring side and AC-GM-15.2 the absent join control). AC-MUR-23-2 Given no open or past league or tournament, when `/tournament` opens, then the page shows exactly "Tiada liga atau tournament buat masa ini." and no card; acceptance of the module also requires a fixture with one open league where AC-MUR-23-1 passes (an empty module is not a pass). AC-MUR-23-3 Given 375 px, then standings scroll inside the table.
- **Gap**: empty; no admin to create. **FD**: none. **Decided**: OQ-MUR-17 (empty-state copy) (section 6.1).

### R1-MUR-24 Topik
- **Action**: Fix
- **Screen specification (from V2)** (route `/topics`, browser title "Topik — PRESTASIPLUS"; detail `/topics/{id}`). List regions: (1) subject filter select, first option "Semua Subjek", then 14 subjects that have topics (Bahasa Inggeris, Bahasa Melayu, Ekonomi, Fizik, Geografi, Matematik, Matematik Tambahan, Pendidikan Islam, Pendidikan Moral, Pendidikan Seni Visual, Perniagaan, Sains, Sejarah, Tasawwur Islam); (2) topic cards, each: topic title (in V2 a DSKP learning-standard sentence, e.g. "Mendengar, memahami dan menuturkan ayat dalam pelbagai jenis komunikasi lisan dengan betul."), subject name, "{n} soalan tersedia" (V2: 0 on the first cards), link "Lihat Topik" (opens the detail page). Detail regions: link "Kembali ke Senarai Topik"; title; subject name; sub-topic list with empty text "Tiada subtopik direkodkan untuk bab ini."; practice box "{n} soalan sedia untuk latihan" and, when 0, the message "Belum ada soalan diluluskan untuk bab ini, jadi latihan belum boleh dimulakan." (no start button in that state). Start button when n is above 0, loading and error states: Not observed in V2 — follow FR-MUR-24-* and FR-X6. V2 differs: topic titles are DSKP sentences; V3 uses the structure of D89/FR-X1-4.
- **Confirmed in the screens (earlier review)**: Confirmed: heading "Topik" with the subject filter ("Semua Subjek" + 14 subjects); cards with the topic title, subject, "0 soalan tersedia" and the link "Lihat Topik"; detail "Kembali ke Senarai Topik", "Tiada subtopik direkodkan untuk bab ini.", "0 soalan sedia untuk latihan", "Belum ada soalan diluluskan untuk bab ini, jadi latihan belum boleh dimulakan.". **V2 differs**: the V2 "topics" are DSKP learning-standard sentences and "bab"; PRD follows the DSKP/Bab tree decided by D89 and DK (4.10).
- **Current gap and root cause (change list)**: remove the lower-form gate (`src/modules/m03-curriculum/pages/TopicsPage.vue:32,50-53`); filters for T1-T5; wording "Tiada soalan" instead of V2's "belum boleh dimulakan"; data: topic tree on UAT is empty.
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Tingkatan | select | Ya | the pupil's own form | OPT-TINGKATAN, no "Semua" option; applies on change | - | - | query `tahap` | topics read |
  | Subjek | select | Tidak | "Semua Subjek" | subjects that have topics for the form, name asc; applies on change, no button | - | Tingkatan | query `subjek` | same |
  - Behaviour: T1-T5 are all served where questions exist; the "akan datang" gate is removed (D101). A form with no DSKP map shows the data-empty copy of the screen specification, not "akan datang".
  - New requirements: FR-MUR-24-6 The Tingkatan select is rendered before Subjek.
  - New acceptance criteria: AC-MUR-24-5 Given a T1 pupil, then Topik lists T1 topics with questions and no "akan datang".
- **Name**: "Topik" (page "Topik Pembelajaran", sub "Terokai semua topik mengikut subjek"). **Route**: `/topics`, `/topics/:id`. **Row**: 24. **Priority**: P1.
- **Current status**: GH works (grade and subject filters, subtopic cards); UAT T1 shows "Kandungan akan datang" (`TopicsPage.vue:32,50-53`), T5 "Tiada topik" (no topic tree).
- **Outcome**: browse the topic tree per subject and start practice on a topic.
- **Reference (V2 `topics*.blade.php`)**: subject filter; SP cards with "{n} soalan tersedia"; empty "Tiada topik buat masa ini" / "Bank topik DSKP belum tersedia untuk pilihan ini. Cuba pilih subjek lain atau semak semula nanti."; detail page lists subtopics with a practice button. Level shown: Bidang/Tajuk from the chapter and topic tree (not DSKP SP, see 4.10).
- **FRs**: FR-MUR-24-1 filters Tingkatan (T1-T5, default own form, D101) and Subjek. FR-MUR-24-2 each card shows topic, subtopics and "{n} soalan tersedia" per D91. FR-MUR-24-3 a topic with questions starts a practice session on it; with none the card states "Tiada soalan" (not "akan datang"). FR-MUR-24-4 the gate `lower-form` is removed. FR-MUR-24-5 the empty state uses the V2 copy above as a data-empty message only.
- **Data**: topics (owner M03), questions (M04); admin Kurikulum Topik screens and Bab/Topik assignment (cross-ref); UAT topic tree 0 rows.
- **ACs**: AC-MUR-24-1 Given a data precondition of a Sains topic with 3 servable MCQs for T1 and for T5, when a T1 pupil and a T5 pupil open Topik, then each sees that topic with "3 soalan tersedia" and can start a 3-question session. AC-MUR-24-2 Given a topic with 3 servable questions, then "3 soalan tersedia" and a session of 3. AC-MUR-24-3 Given no topics, then the V2 empty text shows, not "akan datang". AC-MUR-24-4 Given 375 px, then filters stack and cards are one column.
- **Gap**: `TopicsPage.vue:32,50-53` gate; UAT empty tree. **FD**: FD-MUR-30. **Decided**: none needed.

### R1-MUR-25 Peta Belajar
- **Action**: Fix
- **Screen specification (from V2)** (route `/peta-belajar`, browser title "Peta Belajar — PRESTASIPLUS"). Regions: (1) heading "🗺️ Peta Belajar" and the line "Terokai perjalanan {Subjek} — takluki setiap pulau! 🏝️"; (2) two summary tiles "{done}/{total}" "Topik Selesai" and "{p}%" "Kemajuan" (observed 0/34, 0%); (3) subject tab row, 14 tabs: Bahasa Inggeris, Bahasa Melayu, Matematik, Pendidikan Islam, Pendidikan Moral, Sains, Sejarah, Ekonomi, Fizik, Geografi, Matematik Tambahan, Pendidikan Seni Visual, Perniagaan, Tasawwur Islam (V2 defect: each tab links to `/peta-belajar/{kod}`, which returns the 404 page; V3 switches the subject in the same page); (4) the map of the open subject: one node per DSKP standard in order, showing the code (e.g. "1.1.1"), a status chip (observed "Belum tersedia"), the standard text, the skill strand (e.g. "Listening", "Speaking") and the line "Bank soalan belum sedia" when the standard has no approved questions. States with questions (status chips for in progress and done, node action): Not observed in V2 — follow FR-MUR-25-*. Loading and error: Not observed in V2 — follow FR-X6.
- **Confirmed in the screens (earlier review)**: Confirmed: "🗺️ Peta Belajar", "Terokai perjalanan {subjek} — takluki setiap pulau! 🏝️", tiles "0/34 Topik Selesai" and "0% Kemajuan", a tab per subject (14, alphabetical after the first), island cards per standard with the code (e.g. "1.1.1"), a badge "Belum tersedia", the standard text, the strand ("Listening") and "Bank soalan belum sedia". **V2 differs**: V2's islands are DSKP standards (SP), not textbook Bab; PRD follows D89/DK for the island unit and shows "Tiada soalan" where V2 says "Bank soalan belum sedia".
- **Current gap and root cause (change list)**: remove the lower-form gate (`src/modules/m03-curriculum/pages/LearningMapPage.vue:30,50-53`); islands from Bab/SP with real progress; no lock (D98).
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Subject tab row | tabs | - | first subject with chapters | order BI, BM, Matematik, Pendidikan Islam, Pendidikan Moral, Sains, Sejarah, then Ekonomi, Fizik, Geografi, Matematik Tambahan, Pendidikan Seni Visual, Perniagaan, Tasawwur Islam | - | - | query `subjek` | map read |
  - Behaviour: a chapter without questions shows "Belum tersedia" and `Bank soalan belum sedia`; the gate at `LearningMapPage.vue:30,50-53` is removed for T1-T3; a map with no nodes shows the V2 sentence `Peta Belum Tersedia`.
  - New requirements: FR-MUR-25-6 Subject switching happens in the same page. 
  - New acceptance criteria: AC-MUR-25-5 Given a T2 pupil, then the map shows T2 chapters and no "akan datang".
- **Name**: "Peta Belajar" (sub "Terokai perjalanan pembelajaran — takluki setiap pulau!"). **Route**: `/peta-belajar`. **Row**: 25. **Priority**: P1.
- **Current status**: GH 7 subject tabs, 3 topics, progress 7%; UAT 0/0 and T1 "akan datang" (`LearningMapPage.vue:30,50-53`).
- **Outcome**: a map of chapters as islands with progress.
- **Reference (V2 `peta-belajar.blade.php`)**: one tab per subject; chapter islands in order with status badges (open, "Belum tersedia" for chapters without questions, with line "Bank soalan belum sedia"), progress ring per subject, legend including "Belum tersedia"; a chapter with questions links to a practice session of up to 20 (`min(20, available)`); empty subject "Peta Belum Tersedia" / "Bab DSKP untuk subjek ini belum dimuatkan.". These V2 states describe data absence; the label wording is kept only as data-empty text (OQ-MUR-16).
- **FRs**: FR-MUR-25-1 tabs list subjects that have chapters for the pupil's form (T1-T5, D101). FR-MUR-25-2 each island shows chapter title, number, progress from the pupil's own attempts and status; every chapter with servable questions is open (D98: no lock). FR-MUR-25-3 clicking an open island starts a chapter practice session of up to 20 questions (D91 count). FR-MUR-25-4 a chapter without questions is shown as "Tiada soalan", not as a stub page. FR-MUR-25-5 overall progress = chapters with at least one correct answer / chapters.
- **Data**: chapters (M03), Bab links (M04, D89), attempts (M05).
- **ACs**: AC-MUR-25-1 Given a data precondition of one Sains chapter with 5 servable MCQs for T1 and for T5, when a T1 pupil and a T5 pupil open Peta Belajar, then each sees the Sains tab with that chapter as an open island and tapping it starts a 5-question session. AC-MUR-25-2 Given chapter 4 and chapter 1 with no progress, then both open. AC-MUR-25-3 Given no chapters, then the empty state shows with data wording. AC-MUR-25-4 Given 375 px, then islands wrap in one or two columns.
- **Gap**: `LearningMapPage.vue:30,50-53` gate; UAT 0 nodes. **FD**: FD-MUR-30. **Decided**: OQ-MUR-16 (section 6.1).

### R1-MUR-26 Set Soalan Guru
- **Action**: Fix (session mode `question_set`, 404 outside the assigned class, answers in the single answer store; the list and play screens exist)
- **Screen specification (from V2)** (route `/set-soalan-saya`, browser title "Set Soalan Guru — PRESTASIPLUS"). One region observed, the empty state: heading "Tiada Set Soalan", text "Guru anda belum menyediakan sebarang set soalan buat masa ini." and "Set soalan akan muncul di sini sebaik sahaja guru anda menerbitkannya.". No button. Populated set cards, the play screen and the result: Not observed in V2 — follow FR-MUR-26-* and section 4.6. Loading and error: Not observed in V2 — follow FR-X6.
- **Confirmed in the screens (earlier review)**: Confirmed with one more line: "Tiada Set Soalan" / "Guru anda belum menyediakan sebarang set soalan buat masa ini." / "Set soalan akan muncul di sini sebaik sahaja guru anda menerbitkannya." A populated set and the play screen are not in the screens (E-13).
- **Current gap and root cause**: the mode is `question_set` everywhere (not `set`); a set outside the pupil's class answers 404; the list is filtered by the set's assigned class(es); answers go to `practice_answers`. Teacher feed is the guru Set Soalan screen (D108(3), R1-GUR-8b).
- **End-to-end flow**: see 46 section 4.11 (D4 Set Soalan Guru).
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Set list; "Mula" | list + button | - | `Tiada Set Soalan` | published sets assigned to the pupil's own classes (multi-class sets allowed), newest first; an unassigned set id answers 404 (ERR-ACC-02), enforced in the start call `POST /api/practice/sessions` with `questionSetId` (API-PRAC-01) | R1 sets have no attempt cap (the teacher form R1-GUR-8b has no such field), so a pupil may start a set again and each start is a new session; `Tiada percubaan lagi untuk set ini.` (ERR-PRAC-05) is not produced for sets in R1; `Ujian ini sudah selesai.` (ERR-PRAC-04) | assignment | rows of mode `question_set` | API-PRAC family (`question_set`) |
  | Timer | read-only | - | - | R1 sets carry no time limit (R1-GUR-8b has no such field), so no timer is shown; if a set row ever holds `timeLimitSec`, at 0 the session auto-submits with `Masa telah tamat. Jawapan anda telah dihantar.` | - | - | - | - |
  - New requirements: FR-MUR-26-6 Rows carry mode `question_set` and the assigned-class check is enforced on the server. 
  - New acceptance criteria: AC-MUR-26-6 Given a set assigned to another class, then its id answers 404.
- **Name**: "Set Soalan Guru" (sub "Set soalan yang disediakan oleh guru anda"). **Route**: `/set-soalan-saya`, `/pelajar/set/:id`. **Row**: 26. **Priority**: P1. **Delivery**: 1.0 (linked from R1-MUR-2 and R1-MUR-8).
- **Current status**: V3 built, empty state; V2 `question_sets` has 0 rows.
- **Outcome**: do the question sets a teacher published for the class.
- **Reference (V2 mechanism 2.7)**: list of published sets of the pupil's class teachers; empty "Tiada Set Soalan" / "Guru anda belum menyediakan sebarang set soalan buat masa ini."; play view is the MCQ quiz; access only if the set is assigned to the pupil's class (V2: teacher teaches the class); options shuffled and re-lettered; items still approved at serve time; mode `question_set` (V3 name).
- **FRs**: FR-MUR-26-1 lists only published sets assigned to a class the pupil belongs to (the teacher chooses the class(es) explicitly when assigning, R1-GUR-8b), with title, subject, "{n} soalan"; a set assigned to another class is not listed. FR-MUR-26-2 the quiz follows 4.6/Latih Tubi engine, items archived since publication drop out and the count updates. FR-MUR-26-3 each answer is written to `practice_answers` with mode `question_set` (feeds Prestasi, Analisa Item, Heatmap, Headcount AR per HC-3, and the teacher's set results) and rewards per 4.4. FR-MUR-26-4 another class's set returns 404 (record outside scope, 60 §1.7). FR-MUR-26-5 Dashboard "Set Soalan Dari Cikgu" links here.
- **Data**: teacher sets (owner M10); teacher feed: Guru Set Soalan creation.
- **ACs**: AC-MUR-26-1 Given a published set of 5 questions, then the pupil starts and finishes it and a `question_set` session with 5 rows in `practice_answers` exists. AC-MUR-26-2 Given a set of another class, then it is not listed and its id answers 404. AC-MUR-26-5 Given a teacher assigns a set to class A only, then a pupil of class A sees it and a pupil of class B does not (AC-CHAIN-4). AC-MUR-26-3 Given no sets, then the exact empty text shows. AC-MUR-26-4 Given 375 px, then set cards stack. AC-MUR-26-6 (stated in the field spec above) proves FR-MUR-26-6 together with AC-MUR-26-1: every row of the finished session has mode `question_set`, and a set of another class answers 404.
- **Gap**: no content. **FD**: none. **Decided**: none needed.

### R1-MUR-27 Audio KBAT
- **Action**: Keep
- **Screen specification (from V2)** (route `/audio-kbat`, browser title "Audio KBAT — PRESTASIPLUS"). One region observed, the empty state: heading "Belum ada audio diterbitkan" and text "Audio KBAT akan muncul di sini selepas dimuat naik dan diterbitkan.". No button. Published audio list, player and questions: Not observed in V2 — follow FR-MUR-27-*. Loading and error: Not observed in V2 — follow FR-X6.
- **Confirmed in the screens (earlier review)**: Confirmed: "Belum ada audio diterbitkan" / "Audio KBAT akan muncul di sini selepas dimuat naik dan diterbitkan." A published audio set is not in the screens (E-13).
- **Current gap and root cause**: None. Verify the ACs only.
- **End-to-end flow**: see 46 section 4.12 (D7 Audio KBAT).
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Tahap | select | Tidak | "Semua Tahap" | OPT-TINGKATAN | - | - | query | API-PRAC-11 |
  | Subjek | select | Tidak | "Semua Subjek" | OPT-SUBJEK | - | - | query | same |
  - Behaviour: objective parts follow the drill rules; answers are stored with mode `audio_kbat`; the empty copy is `Belum ada audio diterbitkan` with the sub-text of the screen specification.
  - New requirements: FR-MUR-27-5 Rows carry mode `audio_kbat`.
  - New acceptance criteria: AC-MUR-27-4 Given an Audio KBAT attempt, then its rows have mode `audio_kbat`.
- **Name**: "Audio KBAT". **Route**: `/audio-kbat`, listening test page. **Row**: 27. **Priority**: P2.
- **Current status**: V3 filters Tahap/Subjek and "Ujian Mendengar"; V2 empty "Belum ada audio diterbitkan".
- **Outcome**: listen to HOTS questions and answer.
- **Reference (V1 M09 audio KBAT)**: list of published audio sets with subject and level; player with transcript off by default; "Ujian Mendengar" questions after listening; empty "Belum ada audio diterbitkan".
- **FRs**: FR-MUR-27-1 lists only published audio sets for T1-T5 filters. FR-MUR-27-2 the player plays, pauses and seeks; a missing audio file shows an error with retry, never a silent player. FR-MUR-27-3 "Ujian Mendengar" questions are marked on the server and recorded. FR-MUR-27-4 empty state exact copy.
- **Data**: audio sets (owner M09); admin Audio KBAT screen (cross-ref).
- **ACs**: AC-MUR-27-1 Given a published set, then audio plays and the test records a session. AC-MUR-27-2 Given a missing file, then an error and retry show. AC-MUR-27-3 Given 375 px, then the player is full width.
- **Gap**: no content. **FD**: none. **Decided**: none needed.

### R1-MUR-28 Syiling & Token
- **Action**: Complete
- **Screen specification (from V2)** (V2 route `/gamification`, browser title "Gamifikasi — PRESTASIPLUS"; V3 module Syiling & Token). Regions, top to bottom: (1) four tiles, value above label: 🪙 "Syiling Kamu", 💎 "Token", ⭐ "Mata (Lvl {n})", and the tier tile (🥉 "Gangsa" over "Tier Semasa"); (2) block "Kedai Hadiah Digital": eight gift cards, each with icon 🎟️, name and token price "💎 {n}": "Roblox Gift Card RM10" 10, "Roblox Gift Card RM50" 50, "Roblox Gift Card RM100" 100, "Mobile Legends 86 Diamonds" 5, "Free Fire 100 Diamonds" 10, "Genshin Impact 60 Genesis Cr..." 5 (name cut with "..."), "PUBG Mobile 60 UC" 5, "Steam Wallet RM30" 30 (a card opens Kedai Hadiah, R1-MUR-31); (3) block "Tier" listing "🥉 Gangsa 0+", "🥈 Perak 500+", "🥇 Emas 2,000+", "💎 Platinum 5,000+" (the thresholds are in coins or points per FR-MUR-28-*); (4) block "Transaksi Terkini", empty (observed) "Tiada transaksi.". Navigation to Tukar Token, Cabaran Harian, Pencapaian and others from this hub: Not observed in V2 — follow FR-MUR-28-*. Loading and error: Not observed in V2 — follow FR-X6.
- **Confirmed in the screens (earlier review)**: Confirmed and closes E-11 for this page: tiles "Syiling Kamu", "Token", "Mata (Lvl 1)", "Tier Semasa 🥉 Gangsa"; block "Kedai Hadiah Digital" with 8 gifts (Roblox Gift Card RM10/50/100 at 💎 10/50/100, Mobile Legends 86 Diamonds 5, Free Fire 100 Diamonds 10, Genshin Impact 60 Genesis Cr... 5, PUBG Mobile 60 UC 5, Steam Wallet RM30 30); "Tier" table Gangsa 0+, Perak 500+, Emas 2,000+, Platinum 5,000+; "Transaksi Terkini" with "Tiada transaksi.".
- **Current gap and root cause (change list; reuse the hub page)**: add the "Kedai Hadiah Digital" block (today absent); set the tier table to 0 / 500 / 2,000 / 5,000 as admin config; keep the existing transactions list and links.
- **End-to-end flow**: see 48 GAME-17 (Syiling, XP, Level, Tier, Streak, daily login).
- **Field & behaviour spec** (read only)
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Four tiles; tier card | read-only | - | 0 | OPT-TIER (Gangsa 0+ 50:1, Perak 500+ 40:1, Emas 2,000+ 30:1, Platinum 5,000+ 20:1; admin config, K22) | - | - | - | wallet read |
  | Transaksi | list | - | empty copy of the screen specification | the last 10 on the hub; the history page is 15 per page, newest first | - | - | query `halaman` | `/gamification/history` |
  | Kedai Hadiah Digital block | cards | - | - | the shared catalogue (D113), eight gift cards at most with token prices; opens R1-MUR-31 | - | - | - | rewards read |
  - New requirements: FR-MUR-28-6 The hub shows the Kedai Hadiah Digital block from the shared `rewards` catalogue (the V3 gap).
  - New acceptance criteria: AC-MUR-28-5 Given 12 transactions, then the hub shows 10 and the history page 12 on page 1.
- **Name**: "Syiling & Token" (heading "Syiling & Ganjaran", sub "Kumpul syiling, tebus hadiah"; V3 title "Gangsa Tier"). **Route**: `/gamification`, `/gamification/history`. **Row**: 28. **Priority**: P1. **Delivery**: 1.0 (linked from the header coin pill and R1-MUR-2).
- **Current status**: V3 hub with tier and progress to Perak, links to Tukar/Cabaran/Kedai, challenge summary, transactions; no catalogue block.
- **Outcome**: see wallet, tier and transactions.
- **Reference (V2 `gamifikasi.blade.php`)**: balances (syiling, token, mata), current tier with progress to the next, tier table by minimum syiling, a Kedai Hadiah Digital block of up to 8 active gifts, last 10 transactions (empty "Tiada transaksi."), links to the gamification pages.
- **FRs**: FR-MUR-28-1 balances equal the header pills and Profil. FR-MUR-28-2 tier and next-tier progress computed from lifetime syiling and the tier table, whose V2 values are Gangsa 0+, Perak 500+, Emas 2,000+, Platinum 5,000+ (configurable). FR-MUR-28-3 the catalogue block shows up to 8 active gifts or is hidden when none (no empty card). FR-MUR-28-4 transactions list shows type, amount, date, paged at `/gamification/history`. FR-MUR-28-5 every figure comes from the wallet ledger.
- **Data**: wallet, tiers, ledger (owner M14); admin Gamifikasi screens (missing in V3 admin; cross-ref).
- **ACs**: AC-MUR-28-1 Given 374 syiling and tier thresholds 0/500, then Gangsa with progress 374/500. AC-MUR-28-2 Given a quiz reward, then a transaction row appears. AC-MUR-28-3 Given no transactions, then "Tiada transaksi." shows. AC-MUR-28-4 Given 375 px, then tier table scrolls inside.
- **Gap**: no catalogue block (parity gap). **FD**: none. **Decided**: none needed.

### R1-MUR-29 Tukar Token
- **Action**: Keep
- **Screen specification (from V2)** (V2 route `/gamification/convert`, browser title "Tukar Token — PRESTASIPLUS"). Regions: (1) two balance tiles "Syiling" and "Token"; (2) card "Tukar sekarang" with "Kadar tahap anda: {n} syiling = 1 token", the tier chip (e.g. "🥉 Gangsa"); when the pupil has fewer coins than one token costs (observed state): "Anda perlu sekurang-kurangnya 50 syiling" / "untuk menukar 1 token. Teruskan berlatih untuk mengumpul syiling." and button "Mula Latih Tubi" (opens Latih Tubi); when coins are enough, the conversion controls (the 50 / 250 / Semua choices of V3): Not observed in V2 — follow FR-MUR-29-*; (3) block "Kadar mengikut tahap", four rows: "🥉 Gangsa" (marked "TAHAP ANDA" when current) "0+ syiling sepanjang hayat · 50 : 1", "🥈 Perak" "500+ syiling sepanjang hayat · 40 : 1", "🥇 Emas" "2,000+ syiling sepanjang hayat · 30 : 1", "💎 Platinum" "5,000+ syiling sepanjang hayat · 20 : 1"; (4) block "Sejarah penukaran", empty (observed) "Belum ada penukaran.". Success and error messages, loading: Not observed in V2 — follow FR-MUR-29-* and FR-X6.
- **Exact copy and values (earlier review; closes the rate question)**: tiles "Syiling" and "Token"; "Tukar sekarang", "Kadar tahap anda: 50 syiling = 1 token", tier chip "🥉 Gangsa", "Anda perlu sekurang-kurangnya 50 syiling untuk menukar 1 token. Teruskan berlatih untuk mengumpul syiling." and button "Mula Latih Tubi"; "Kadar mengikut tahap": Gangsa 0+ → 50 : 1 ("TAHAP ANDA"), Perak 500+ → 40 : 1, Emas 2,000+ → 30 : 1, Platinum 5,000+ → 20 : 1 (lifetime syiling); "Sejarah penukaran" / "Belum ada penukaran.".
- **Current gap and root cause**: None. Verify the ACs only (V3 adds 50/250/Semua amounts, kept).
- **End-to-end flow**: see 48 GAME-18 (Tukar Token).
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Tukar Token amount | choice buttons 50 / 250 / Semua | Ya | none | OPT-TUKAR; tokens = floor(N / rate); debit = tokens x rate; the remainder stays (120 coins, rate 50, choose 100: 2 tokens, balance 20); "Semua" = floor(balance / rate) x rate; a button shows only when balance >= its value and value >= rate; all disabled below the rate | 422 `Jumlah syiling tidak sah.`; below one token: `Anda perlu sekurang-kurangnya {rate} syiling untuk menukar 1 token. Teruskan berlatih untuk mengumpul syiling.` and the button "Mula Latih Tubi" | tier rate | `POST /gamification/convert {syilingAmount}` returns `syilingDebited`, `tokensCredited` | gamification API |
  | Confirm | dialog B-055 | - | - | `Tukar {N} syiling kepada {T} token?`, buttons "Tukar" / "Batal" | - | - | - | - |
  - New requirements: FR-MUR-29-5 The rate is the tier rate of the lifetime-Syiling tier (OPT-TIER).
  - New acceptance criteria: AC-MUR-29-4 Given balance 120, rate 50 and the choice "Semua", then 100 coins are debited, 2 tokens credited, balance 20.
- **Name**: "Tukar Token" (sub "Tukar syiling yang anda kumpul kepada token Kedai Hadiah"; V3 "Tukar Syiling → Token"). **Route**: `/gamification/convert`. **Row**: 29. **Priority**: P1. **Delivery**: 1.0 (linked from R1-MUR-28 and R1-MUR-31).
- **Current status**: V3 same plus amount choices 50/250/Semua.
- **Outcome**: convert coins into tokens used in the reward shops.
- **Reference (V2 `gamifikasi-convert.blade.php`)**: rate by tier (V2 "50:1 Gangsa"), history of conversions; empty "Belum ada penukaran."; no rate set: "Kadar penukaran belum ditetapkan" / "Pentadbir belum menetapkan kadar tukaran syiling → token." (data-config empty state).
- **FRs**: FR-MUR-29-1 the rate shown is the pupil's tier rate: Gangsa 50:1, Perak 40:1, Emas 30:1, Platinum 20:1 (V2 values, configurable), with the sentence "Kadar tahap anda: {n} syiling = 1 token". FR-MUR-29-2 converting N syiling gives floor(N / rate) tokens, debits exactly N used, never below zero, once per click. FR-MUR-29-3 history lists own conversions. FR-MUR-29-4 amount choices (50, 250, "Semua") are kept (V3 addition, not broken).
- **Data**: wallet, tier rates (M14); admin Tier Config.
- **ACs**: AC-MUR-29-1 Given 120 syiling, rate 50, converting 100 gives 2 tokens and leaves 20. AC-MUR-29-2 Given insufficient syiling, then refused. AC-MUR-29-3 Given 375 px, then choices wrap.
- **Gap**: none. **FD**: none. **Decided**: none needed.

### R1-MUR-30 Cabaran Harian
- **Action**: Keep
- **Screen specification (from V2)** (V2 route `/gamification/challenges`, browser title "Cabaran Harian — PRESTASIPLUS"). Regions: (1) date line (V2 prints it in English, "Tuesday, 3 November 2026": defect, V3 prints BM) and the counter "{n} / {total} ganjaran dituntut" (observed "0 / 15"); (2) challenge cards, one per challenge, each with: icon, name, difficulty chip, description, reward "+{n}" "syiling · +{m} mata", "Kemajuan" with bar and "{done} / {target}", and a status label (observed "Belum selesai"; the claim button for a completed challenge: Not observed in V2 — follow FR-MUR-30-*). Difficulty chips in V2 mix English and BM (EASY, MEDIUM, HARD, MUDAH, SEDERHANA, SUSAH): defect, V3 shows "Mudah", "Sederhana", "Sukar" (FD-MUR-35). The 15 observed challenges (name; description; target; coins; points):
  - "Rajin Berlatih"; "Selesaikan 3 kuiz hari ini"; 3; +15; +10. "Si Tepat"; "Dapat 80% ketepatan dalam mana-mana kuiz"; 80; +20; +15. "Penjelajah Topik"; "Latih 3 topik berbeza hari ini"; 3; +25; +20. "Kilat Matematik"; "Jawab 10 soalan dengan betul"; 10; +30; +25. "Selesai 5 Kuiz"; "Lengkapkan 5 kuiz hari ini"; 5; +50; +100.
  - "Ketepatan 80%"; "Capai ketepatan 80% dalam latihan"; 80; +80; +150. "3 Topik Berbeza"; "Cuba 3 topik berlainan"; 3; +60; +120. "Kombo 10"; "Capai kombo 10 jawapan betul"; 10; +120; +200. "Belajar 15 Minit"; "Habiskan 15 minit latihan"; 15; +40; +80. "Mula Hari Ini"; "Selesaikan 1 sesi latihan hari ini"; 1; +10; +5.
  - "Jawab 5 Betul"; "Jawab 5 soalan dengan betul"; 5; +12; +8. "Latihan 10 Minit"; "Berlatih sekurang-kurangnya 10 minit hari ini"; 10; +20; +15. "Kombo 2 Hari"; "Kekalkan kombo latihan selama 2 hari berturut-turut"; 2; +25; +20. "Ketepatan 90%"; "Capai ketepatan 90% dalam sesi latihan"; 90; +35; +30. "Cabaran Kilat"; "Jawab 20 soalan betul dalam satu sesi"; 20; +40; +35.
  Where V3's seeded list differs (V3 has 10), the seed follows FR-MUR-30-*; this list is the V2 observation. Empty, loading and error states: Not observed in V2 — follow FR-X6.
- **Confirmed in the screens (earlier review)**: Confirmed: a date line (V2 prints it in English, "Tuesday, 3 November 2026"; PRD prints it in BM), "0 / 15 ganjaran dituntut", cards with icon, name, difficulty, description, reward "+15 syiling · +10 mata", "Kemajuan 0 / 3", "Belum selesai". Sample rewards (syiling · mata): Rajin Berlatih +15 · +10, Si Tepat +20 · +15, Penjelajah Topik +25 · +20, Kilat Matematik +30 · +25, Selesai 5 Kuiz +50 · +100. V2 prints difficulty as "EASY/MEDIUM/HARD" and "MUDAH" mixed: PRD prints "Mudah/Sederhana/Sukar" (FD-MUR-35).
- **Current gap and root cause**: None. Verify the ACs only (the count 10 vs 15 is an admin configuration, not code).
- **End-to-end flow**: see 48 GAME-19 (Cabaran Harian).
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Tuntut | button | - | - | credits once; a second press is idempotent and shows the claimed state; message `Ganjaran dituntut: +{n} syiling · +{m} mata.` | - | challenge complete | wallet ledger | gamification API |
  - Behaviour: the date line is in BM (the V2 English date is a defect). The seeded list follows 48 GAME-19 (V2 has 15, V3 10).
  - New requirements: FR-MUR-30-6 A claim is idempotent per challenge per day.
  - New acceptance criteria: AC-MUR-30-5 Given a double press on "Tuntut", then the wallet is credited once.
- **Name**: "Cabaran Harian" (sub "Selesaikan cabaran hari ini dan tuntut ganjaran syiling"). **Route**: `/gamification/challenges`. **Row**: 30. **Priority**: P1. **Delivery**: 1.0 (linked from R1-MUR-2 and R1-MUR-28).
- **Current status**: V3 shows 10 challenges, V2 15 ("0 / 15 ganjaran dituntut").
- **Outcome**: daily goals with coin rewards.
- **Reference (V2 `gamifikasi-challenges.blade.php`, `ChallengeProgress`)**: list of active challenges with title, description, difficulty (mudah/sederhana/sukar), progress "{p}/{t}", reward "🪙 +{n}", state "Belum selesai"/done with "Tuntut"; summary "{x} / {y} ganjaran dituntut"; empty "Tiada cabaran aktif" / "Cabaran harian belum dibuka. Semak semula kemudian.". Progress comes from one shared definition (also used by Dashboard) so pages agree.
- **FRs**: FR-MUR-30-1 the list is the active challenges (count from the admin, not fixed). FR-MUR-30-2 progress uses the shared definition; Dashboard and this page agree. FR-MUR-30-3 "Tuntut" credits the reward once and the claimed state persists; resets daily at midnight Malaysia time. FR-MUR-30-4 the summary counts claimed rewards. FR-MUR-30-5 empty state exact copy.
- **Data**: challenges, progress, claims (owner M14); admin Cabaran screen (cross-ref).
- **ACs**: AC-MUR-30-1 Given a completed challenge, then "Tuntut" credits its coins once. AC-MUR-30-2 Given a second press, then no double credit. AC-MUR-30-3 Given progress on Dashboard and here, then equal. AC-MUR-30-4 Given 375 px, then cards are one column.
- **Gap**: count differs (10 vs 15, data decision). **FD**: none. **Decided**: none needed.

### R1-MUR-31 Kedai Hadiah
- **Action**: Complete
- **Screen specification (from V2)** (V2 route `/gamification/rewards`, browser title "Kedai Hadiah — PRESTASIPLUS"). Regions: (1) line "Token anda" with the token balance and link "Tukar syiling → token" (opens Tukar Token); (2) category chips "Semua", "Ecommerce", "Ewallet", "Fnb", "Gaming", "Learning", "Streaming", "Telco" (V2 prints the raw category keys with a capital letter; V3 uses proper BM or English labels per FR-MUR-31-*); (3) reward cards, each: name, category badge in capitals (e.g. "GAMING", "TELCO", "EWALLET"), token price with the word "token", "Nilai muka RM{x}", "Stok: {n}", and a footer that reads "Perlu {n} token lagi" when the pupil cannot afford it (the buy button state when affordable and the confirmation dialog: Not observed in V2 — follow FR-MUR-31-*). Observed cards: "Genshin Impact 60 Genesis Crystals" 5, "Hotlink Topup RM5" 5, "Mobile Legends 86 Diamonds" 5, "PUBG Mobile 60 UC" 5, "TnG eWallet RM5" 5, "Celcom Xpax Topup RM10" 10, "CelcomDigi Topup RM10" 10 and more. Empty state: see the reference behaviour ("Tiada Hadiah Tersedia"). Loading and error: Not observed in V2 — follow FR-X6.
- **Confirmed in the screens (earlier review)**: Confirmed: "Token anda {n}" with link "Tukar syiling → token"; category chips "Semua", "Ecommerce", "Ewallet", "Fnb", "Gaming", "Learning", "Streaming", "Telco"; catalogue cards with name, category in capitals, price "{n} token", "Nilai muka RM5.00", "Stok: {n}" and the button state "Perlu {n} token lagi" when tokens are short (e.g. Genshin Impact 60 Genesis Crystals 5, Hotlink Topup RM5 stok 100, TnG eWallet RM5 stok 96, Celcom Xpax Topup RM10 10). "Tebusan Saya" is not in this capture (E-11b).
- **Current gap and root cause (change list; reuse the page and `shop` API)**: catalogue is empty ("Tiada Hadiah Tersedia") because no gifts are loaded: add the admin Kedai Hadiah screens (missing) and seed from the admin; add the category chips and the "Perlu {n} token lagi" state; fulfilment screen for admins.
- **End-to-end flow**: see 48 GAME-21 (Kedai Hadiah and Tebusan).
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Category chips | chips | - | Semua | OPT-KATEGORI-HADIAH (labels "E-dagang", "E-dompet", "Makanan & Minuman", "Permainan", "Pembelajaran", "Penstriman", "Telco") | - | - | query | rewards read |
  | Tebus | button + dialog B-054 | - | - | title `Tebus hadiah ini?`, body `{nama hadiah} - {n} token akan ditolak daripada baki anda ({baki} token).`, buttons "Tebus" / "Batal"; success `Tebusan berjaya. Status: Menunggu.`; insufficient tokens: disabled with `Perlu {n} token lagi`; stock 0: the control is absent | 409 `Stok hadiah telah habis.`, `Had tebusan bulanan dicapai.`, `Token tidak mencukupi.` (ERR-RWD-01..03) | tokens | `reward_redemptions` | rewards API |
  | Tebusan Saya | list | - | - | OPT-STATUS-REDEEM: `pending_parent_consent` "Menunggu Ibu Bapa", `pending_admin` "Menunggu", `delivered` "Dihantar" (with the delivery code), `cancelled` "Dibatalkan" (tokens and stock refunded once) | second action on a processed row: 409 `Tebusan ini tidak lagi menunggu pemprosesan.` | - | - | same |
  - Behaviour: one catalogue (`rewards` / `reward_redemptions`) for rows 31 and 38 (D113). Parent consent is not built: every gift has `requires_parent_consent = 0` and the status `pending_parent_consent` never occurs in R1 data (48 D-GAME-5), the label exists only for stored data. A double click makes one redemption (idempotent).
  - New requirements: FR-MUR-31-6 Redemption debits tokens and stock in one transaction.
  - New acceptance criteria: AC-MUR-31-5 Given a double click on "Tebus", then one redemption exists and tokens fall once.
- **Name**: "Kedai Hadiah" (sub "Tebus token anda dengan hadiah digital"; badge "DIGITAL"). **Route**: `/gamification/rewards`. **Row**: 31. **Priority**: P1. **Delivery**: 1.0 (linked from R1-MUR-28).
- **Current status**: V3 "Tiada Hadiah Tersedia", no category filter, catalogue not seeded; admin cannot add rewards (no admin screen).
- **Outcome**: redeem tokens for digital rewards.
- **Reference (V2 `gamifikasi-rewards.blade.php`)**: catalogue cards (name, token price, stock, category) with category filter; "Tebus"; "Tebusan Saya" list (empty "Anda belum menebus sebarang hadiah."); catalogue empty "Tiada hadiah tersedia" / "Katalog hadiah belum dibuka untuk kategori ini.".
- **FRs**: FR-MUR-31-1 only active gifts with stock are redeemable; price in tokens. FR-MUR-31-2 "Tebus" debits tokens and stock once, creates a redemption record and shows the delivery code or status; insufficient tokens refused. FR-MUR-31-3 category filter works. FR-MUR-31-4 "Tebusan Saya" lists own redemptions with status (administrators fulfil in the admin): "Menunggu" (pending_admin), "Dihantar" (delivered, shows the delivery code the admin pasted) and "Dibatalkan" (cancelled, tokens refunded); the same words are used in R1-ADM-P2-08. FR-MUR-31-5 no control for a gift without stock.
- **Data**: gifts, redemptions (owner M15/M14); admin Kedai Hadiah and Kawalan Reward (missing; cross-ref, blocks fulfilment).
- **ACs**: AC-MUR-31-1 Given a gift at 10 tokens and a pupil with 12, then redeeming leaves 2 and creates a redemption. AC-MUR-31-2 Given stock 0, then not redeemable. AC-MUR-31-3 Given a double click, then one redemption. AC-MUR-31-4 Given 375 px, then cards are one column and the confirm dialog fits.
- **Gap**: catalogue empty, no admin screen. **FD**: none. **Decided**: none needed.

### R1-MUR-32 Marketplace
- **Action**: Complete
- **Screen specification (from V2)** (route `/marketplace`, browser title "Marketplace — PRESTASIPLUS"). Regions: (1) price note "Harga di Marketplace dalam Ringgit (RM) — bukan syiling atau token. Pesanan anda direkodkan di sini dan penjual akan menghubungi anda untuk pembayaran."; (2) product grid; empty state (observed) "Tiada produk tersedia" / "Belum ada penjual diluluskan yang menyenaraikan produk aktif."; (3) section "Pesanan saya" with the pupil's orders; empty state (observed) "Anda belum membuat sebarang pesanan.". Product card fields, the order button and dialog, order statuses: Not observed in V2 — follow FR-MUR-32-*. Loading and error: Not observed in V2 — follow FR-X6.
- **Confirmed in the screens (earlier review)**: Confirmed and closes OQ-MUR-18: note "Harga di Marketplace dalam Ringgit (RM) — bukan syiling atau token. Pesanan anda direkodkan di sini dan penjual akan menghubungi anda untuk pembayaran." (so orders are recorded and the seller contacts the buyer: no online payment); empty "Tiada produk tersedia" / "Belum ada penjual diluluskan yang menyenaraikan produk aktif."; section "Pesanan saya" with "Anda belum membuat sebarang pesanan.". Product cards with data are not in the screens (E-11c).
- **Current gap and root cause (change list)**: remove sample products from production data; add "Pesanan saya" and the order action with the note above; admin Marketplace screens are missing.
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Kategori | select | Tidak | Semua | Semua plus the admin-defined categories | - | - | query | marketplace read |
  | Keadaan | select | Tidak | Semua | Semua, Baharu, Terpakai | - | - | query | same |
  | Susun | select | Tidak | Terbaru | Terbaru, Harga: Rendah ke Tinggi, Harga: Tinggi ke Rendah | - | - | query | same |
  | Order dialog: Kuantiti | number | Ya | 1 | integer 1..stock | `Nilai mesti antara 1 dan {stok}.` | - | - | order API |
  | Order dialog: Catatan (pilihan) | text | Tidak | empty | max 255 | `Catatan tidak boleh melebihi 255 aksara.` | - | - | same |
  | Batal / Hantar Pesanan | buttons | - | - | success `Pesanan anda telah direkodkan. Penjual akan menghubungi anda.` | - | - | order row | same |
  - Behaviour: prices are in Ringgit (RM), no online payment (FR-MUR-32-4); the filter and order values above are R1 decision D113.
  - New requirements: FR-MUR-32-6 The sample products are replaced by admin-managed products. 
  - New acceptance criteria: AC-MUR-32-5 Given a quantity above stock, then `Nilai mesti antara 1 dan {stok}.` shows.
- **Name**: "Marketplace" (sub "Produk pembelajaran daripada penjual yang diluluskan"). **Route**: `/marketplace`. **Row**: 32. **Priority**: P2.
- **Current status**: V3 sample products with filters category/condition/sort and discounts; "Pesanan saya" not visible; V2 empty "Tiada produk tersedia" / "Belum ada penjual diluluskan yang menyenaraikan produk aktif." and "Anda belum membuat sebarang pesanan.".
- **Outcome**: browse and order learning products from approved sellers.
- **Reference (V2 `marketplace.blade.php`, M20)**: product cards, filters, order list.
- **FRs**: FR-MUR-32-1 only active products of approved sellers show. FR-MUR-32-2 filters (category, condition, sort) work. FR-MUR-32-3 ordering creates an order with status and the pupil sees "Pesanan saya" with the empty text "Anda belum membuat sebarang pesanan.". FR-MUR-32-4 prices are in Ringgit; there is no online payment: the order is recorded and the seller contacts the buyer, with the page note "Harga di Marketplace dalam Ringgit (RM) — bukan syiling atau token. Pesanan anda direkodkan di sini dan penjual akan menghubungi anda untuk pembayaran." (V2 route `/marketplace`). FR-MUR-32-5 sample/demo products never reach production.
- **Data**: products, sellers, orders (owner M20); admin Marketplace screens (missing; cross-ref).
- **ACs**: AC-MUR-32-1 Given an approved product, then it lists and can be ordered and the order shows in "Pesanan saya". AC-MUR-32-2 Given no products, then V2 empty text. AC-MUR-32-3 Given a seller not approved, then products hidden. AC-MUR-32-4 Given 375 px, then filters collapse into a drawer.
- **Gap**: sample data, no admin, BE read-only. **FD**: none. **Decided**: OQ-MUR-18 (section 6.1).

### R1-MUR-33 Papan Pendahulu
- **Action**: Complete
- **Screen specification (from V2)** (V2 route `/leaderboard`, also `/pelajar/leaderboard?skop={kelas|sekolah}&period={all|...}`; browser title "Papan Pendahulu — PRESTASIPLUS"). Regions: (1) hero 🏆 with heading "Papan Pendahulu" and sub "Siapa kumpul syiling paling banyak?"; (2) scope tabs "Kelas" and "Sekolah" (each with an icon); a tab reloads the page with the scope in the address; (3) period chips "Semua Masa", "Minggu Ini", "Bulan Ini"; (4) card "Kedudukan Anda" with four figures: "#{rank}" "Ranking", "{n}" "Syiling", "{p}%" "Ketepatan", "🔥 {n}" "Streak"; (5) podium of the top three: crown 👑 on the first, avatar initial, pupil name, "{p}% ketepatan", coins, rank 1 to 3; (6) table with columns "#", "Pelajar", "Syiling", "Ketepatan", "Streak" for the rest. Table rows were masked in the capture. Which names other pupils see: follow FR-MUR-33-* and the privacy rules. Empty state, pager and error: Not observed in V2 — follow FR-MUR-33-* and FR-X6.
- **Confirmed in the screens (earlier review)**: Confirmed: heading "Papan Pendahulu" / "Siapa kumpul syiling paling banyak?"; scope tabs "Kelas", "Sekolah"; period tabs "Semua Masa", "Minggu Ini", "Bulan Ini"; "Kedudukan Anda" with "#{rank} Ranking", "{n} Syiling", "{x}% Ketepatan", "🔥 {n} Streak"; podium of 3 (👑 first) with "{x}% ketepatan" and syiling; table columns "#", "Pelajar", "Syiling", "Ketepatan", "Streak". Each row opens the public profile `/pelajar/:id`.
- **Current gap and root cause (change list; reuse `LeaderboardPage.vue`, `leaderboard` API)**: add the scope and period tabs and the "Kedudukan Anda" tiles (V3 has podium plus 3 rows only); one route and one API: `/gamification/leaderboard` and `GET /api/gamification/leaderboard` are removed in favour of `/leaderboard` and `GET /api/leaderboard`.
- **End-to-end flow**: see 48 GAME-16 (Papan Pendahulu, Kedudukan, Ranking Battle, Sekolah Bersaing).
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Scope tabs Kelas / Sekolah | tabs | - | Kelas if the pupil is in a class, else Sekolah; with no class the Kelas tab is hidden | OPT-SKOP `kelas`, `sekolah` | - | - | query `skop` | `GET /api/leaderboard` |
  | Period chips | chips | - | Semua Masa | OPT-PERIOD: "Semua Masa" `all`, "Minggu Ini" `week`, "Bulan Ini" `month` ("Minggu"/"Bulan" in FR-MUR-33-1 are shorthand); an absent or unknown `period` is `all` (K8); week = current ISO week from Monday 00:00 MYT, month = current calendar month | - | - | query `period` | same |
  | Rows | list | - | `Belum ada pelajar dalam {kelas|sekolah} anda` | 10 ranked places in all: podium of 3 (ranks 1-3) plus table rows for ranks 4-10, the own row appended when outside the top 10; order = the tie-break chain of 48 GAME-16 (Syiling desc, accuracy desc, longest streak desc, display name asc, user id asc), which gives every pupil a distinct position; first names only | - | - | - | same |
  - Behaviour: `/leaderboard` and `GET /api/leaderboard` are canonical; `/gamification/leaderboard` redirects to `/leaderboard` and `GET /api/gamification/leaderboard` is removed (D113).
  - New requirements: FR-MUR-33-6 Absent or unknown `period` is `all`.
  - New acceptance criteria: AC-MUR-33-5 Given `?period=xyz`, then the chip "Semua Masa" is active.
- **Name**: "Papan Pendahulu" (sub "Kedudukan pelajar terbaik mengikut syiling"; V3 "🏆 Papan Pendahulu"). **Route**: `/leaderboard` (canonical, D113); `/gamification/leaderboard` redirects to it. **Row**: 33. **Priority**: P1. **Delivery**: 1.0 (linked from R1-MUR-8 and R1-MUR-18).
- **Current status**: V3 podium plus 3 rows, no period or scope filter, no own rank; V2 tabs Kelas/Sekolah and Semua Masa/Minggu/Bulan, own rank, podium.
- **Outcome**: see top pupils and own place.
- **Reference (V2 `leaderboard.blade.php`)**: scope `?skop=kelas|sekolah`, period tabs, podium for top 3, table, own rank row; empty "Belum ada pelajar dalam {kelas|sekolah} anda".
- **FRs**: FR-MUR-33-1 scope tabs Kelas and Sekolah and period tabs "Semua Masa", "Minggu", "Bulan". FR-MUR-33-2 ranking by syiling earned in the period (all time = balance) with ties broken by the chain of 48 GAME-16 (accuracy, longest streak, display name, user id), so positions are distinct. FR-MUR-33-3 own rank always visible even outside the top. FR-MUR-33-4 rows show the display name (first name only, section 4.3) and syiling only; the "Ketepatan" and "Streak" columns show the pupil's own values to that pupil and, for others, the same pooled whole-number accuracy (FR-X4-5) and streak, never a school. FR-MUR-33-5 the duplicate route redirects to the single page.
- **Data**: wallet ledger (M14), classes (M10); API `leaderboard`.
- **ACs**: AC-MUR-33-1 Given the Minggu tab, then only coins earned this week count. AC-MUR-33-2 Given the pupil is rank 12, then the own row shows "12" below the top 10. AC-MUR-33-3 Given no pupil in the class, then the V2 empty text. AC-MUR-33-4 Given 375 px, then the podium scales and the table fits.
- **Gap**: filters and own rank missing. **FD**: none. **Decided**: none needed.

### R1-MUR-34 Pencapaian
- **Action**: Keep
- **Screen specification (from V2)** (V2 route `/gamification/achievements`, browser title "Pencapaian — PRESTASIPLUS"). Regions: (1) progress line "Kemajuan lencana" with "{n} / {total}" (observed 0 / 3); (2) badge cards, each: icon, name, condition text, and a state label "Belum dibuka" for a locked badge. Observed cards: 👟 "Langkah Pertama" / "Selesai kuiz pertama"; 🔥 "Streak 7 Hari" / "Login 7 hari berturut"; 🏆 "Juara Battle" / "Menang 10 battle". The unlocked look and its label, and the rarity filter of V3 (25 badges): Not observed in V2 — follow FR-MUR-34-*. Loading and error: Not observed in V2 — follow FR-X6.
- **Confirmed in the screens (earlier review)**: Confirmed: "Kemajuan lencana 0 / 3"; badges "👟 Langkah Pertama — Selesai kuiz pertama", "🔥 Streak 7 Hari — Login 7 hari berturut", "🏆 Juara Battle — Menang 10 battle", each "Belum dibuka". V3 has 25 badges with a rarity filter (kept).
- **Current gap and root cause**: None. Verify the ACs only.
- **End-to-end flow**: see 48 GAME-25 (Pencapaian).
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Rarity filter | chips | - | Semua | OPT-RARITY: Biasa, Jarang, Epik, Legenda | - | - | query | badges read |
  - New requirements: FR-MUR-34-5 Locked badges stay visible and greyed. 
  - New acceptance criteria: AC-MUR-34-4 Given the filter "Epik", then only Epik badges show.
- **Name**: "Pencapaian" (sub "Lencana yang anda telah buka sepanjang perjalanan belajar"; V3 "🏅 Pencapaian Anda"). **Route**: `/gamification/achievements`. **Row**: 34. **Priority**: P2.
- **Current status**: V3 25 badges with rarity filter Biasa/Jarang/Epik/Legenda; V2 3 badges.
- **Outcome**: see badges unlocked and locked.
- **Reference (V2 `gamifikasi-achievements.blade.php`)**: badges with name, description, icon, unlocked date or "Belum dibuka"; empty "Tiada pencapaian dikonfigurasi" / "Senarai lencana belum ditetapkan oleh pentadbir.".
- **FRs**: FR-MUR-34-1 all configured badges show, locked ones greyed with "Belum dibuka". FR-MUR-34-2 unlock is awarded once by the rule of each badge and shown with date. FR-MUR-34-3 the rarity filter (V3 addition) is kept and filters correctly. FR-MUR-34-4 the unlocked count equals Profil "Koleksi Lencana".
- **Data**: badges (owner M14); admin badge config (cross-ref).
- **ACs**: AC-MUR-34-1 Given a first completed quiz, then the matching badge unlocks once. AC-MUR-34-2 Given a filter "Jarang", then only those show. AC-MUR-34-3 Given 375 px, then badges are 2 columns.
- **Gap**: none. **FD**: none. **Decided**: none needed.

### R1-MUR-35 Kotak Misteri
- **Action**: Fix
- **Screen specification (from V2)** (V2 route `/gamification/mystery-box`, browser title "Kotak Misteri — PRESTASIPLUS"). Regions: (1) 🎁 box card: "Kos satu kotak" "50" "syiling", "Baki syiling anda: {n}", and, when the balance is too low (observed), "Anda perlu {n} syiling lagi untuk membuka kotak." with link/button "Kumpul syiling" (opens Latih Tubi); when affordable, the open button: Not observed in V2 — follow FR-MUR-35-*; (2) block "Peluang ganjaran", seven rows prize then chance: "10 syiling" 40%, "25 syiling" 25%, "60 syiling" 15%, "1 token" 10%, "150 syiling" 6%, "3 token" 3%, "500 syiling — jackpot!" 1%; (3) disclaimer "Purata ganjaran lebih rendah daripada kos kotak — main untuk keseronokan, bukan untuk mengumpul syiling."; (4) block "Kotak yang telah dibuka", empty (observed) "Anda belum membuka sebarang kotak.". Reveal animation, result message, loading and error: Not observed in V2 — follow FR-MUR-35-* and FR-X6.
- **Exact values (earlier review; closes the box-model question and E-11)**: "Kos satu kotak 50 syiling", "Baki syiling anda: {n}", "Anda perlu 50 syiling lagi untuk membuka kotak." and button "Kumpul syiling"; "Peluang ganjaran": 10 syiling 40%, 25 syiling 25%, 60 syiling 15%, 1 token 10%, 150 syiling 6%, 3 token 3%, "500 syiling — jackpot!" 1% (sums to 100%); disclaimer "Purata ganjaran lebih rendah daripada kos kotak — main untuk keseronokan, bukan untuk mengumpul syiling."; "Kotak yang telah dibuka" / "Anda belum membuka sebarang kotak.".
- **Current gap and root cause (change list; `MysteryBoxPage.vue`, m15 API)**: replace the four token boxes by the single 50-syiling box with these odds (admin-configurable), add the odds table and the disclaimer.
- **End-to-end flow**: see 48 GAME-23 (Kotak Misteri).
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Buka Kotak | button + dialog B-056f | - | - | cost 50 Syiling (admin `mystery_box_cost`); dialog title `Buka kotak?`, body `50 syiling akan ditolak daripada baki anda ({baki} syiling).`, buttons "Buka Kotak" / "Batal" | `Anda perlu {n} syiling lagi untuk membuka kotak.` | balance | debit once per press (idempotency key) | gamification API |
  - New requirements: FR-MUR-35-6 One 50-Syiling box with the prize table of 48 GAME-23.
  - New acceptance criteria: AC-MUR-35-5 Given a double press, then one box is opened and 50 Syiling debited once.
- **Name**: "Kotak Misteri" (sub "Buka kotak dengan syiling — ganjaran ditentukan secara rawak"). **Route**: `/gamification/mystery-box`. **Row**: 35. **Priority**: P2.
- **Current status**: V3 4 boxes (2/5/10 tokens) with reward ranges; V2 one box at 50 syiling, odds table (10-500 syiling, 1-3 token) and history. Model differs.
- **Outcome**: a random reward for coins.
- **Reference (V2)**: box price in syiling, odds table, "Buka" action, result animation, history; empty "Anda belum membuka sebarang kotak.".
- **FRs**: FR-MUR-35-1 the box follows V2: one box costing 50 syiling, odds table shown (10 syiling 40%, 25 syiling 25%, 60 syiling 15%, 1 token 10%, 150 syiling 6%, 3 token 3%, 500 syiling jackpot 1%) and the disclaimer "Purata ganjaran lebih rendah daripada kos kotak — main untuk keseronokan, bukan untuk mengumpul syiling." (V3's four token boxes are replaced). FR-MUR-35-2 opening debits the price once and credits a reward drawn server-side by the shown odds; the result matches the wallet. FR-MUR-35-3 history lists own openings. FR-MUR-35-4 insufficient coins refused with a BM message. FR-MUR-35-5 the draw is not repeatable by refresh.
- **Data**: box config, history (owner M14); admin config.
- **ACs**: AC-MUR-35-1 Given 80 syiling and a 50 box, then opening leaves 30 plus the reward. AC-MUR-35-2 Given a box with the configured odds shown on the page (for the test: 60% reward A, 30% reward B, 10% reward C) and 2,000 server-side draws in a test harness, then each outcome's observed frequency is within 3 percentage points of its configured probability, and every draw credits exactly the reward it reports. AC-MUR-35-3 Given insufficient coins, then refused. AC-MUR-35-4 Given 375 px, then the odds table scrolls inside.
- **Gap**: model mismatch. **FD**: none (pending OQ-MUR-19). **Decided**: OQ-MUR-19 (section 6.1).

### R1-MUR-36 Rujuk Kawan
- **Action**: Fix
- **Screen specification (from V2)** (V2 route `/gamification/referral`, browser title "Rujuk Kawan — PRESTASIPLUS"). Regions: (1) "Kod rujukan anda" with the pupil's own 8-character code; (2) "Pautan jemputan" with the invite link and a button "Salin" that turns into "Disalin" after copying; (3) explanation "Setiap kawan yang mendaftar melalui pautan ini memberi anda 100 syiling." and "Kawan anda masih perlu kod pendaftaran sekolah mereka sendiri."; (4) two counters "Kawan disertakan" and "Syiling bonus" (observed 0, 0); (5) block "Kawan yang telah sertai", empty (observed) "Belum ada kawan mendaftar melalui pautan anda. Kongsi pautan di atas untuk mula.". Populated friend rows, loading and error: Not observed in V2 — follow FR-MUR-36-* and FR-X6.
- **Exact copy (earlier review)**: "Kod rujukan anda" (8 characters), "Pautan jemputan" with "Salin" / "Disalin", "Setiap kawan yang mendaftar melalui pautan ini memberi anda 100 syiling.", "Kawan anda masih perlu kod pendaftaran sekolah mereka sendiri.", tiles "Kawan disertakan" and "Syiling bonus", "Kawan yang telah sertai" with the empty line "Belum ada kawan mendaftar melalui pautan anda. Kongsi pautan di atas untuk mula."
- **Current gap and root cause (change list)**: set the reward to 100 syiling per friend (V3 gives 50 to the referrer and 25 to the friend), add the two sentences above, keep WhatsApp/Telegram share buttons.
- **End-to-end flow**: see 48 GAME-24 (Rujuk Kawan).
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Salin / WhatsApp / Telegram | buttons | - | - | copy the code or link; share targets | clipboard blocked: select the text | - | - | - |
  - Behaviour: reward 100 Syiling per rewarded friend to the referrer (admin `referral_referrer_syiling`, default 100; cap `referral_max_rewarded` 20); the contract constants 50/25 are replaced (K18). An unknown referral code on registration is silently ignored.
  - New requirements: FR-MUR-36-6 The referral reward is read from the admin setting.
  - New acceptance criteria: AC-MUR-36-5 Given a friend registers with the code, then the referrer gains 100 Syiling once.
- **Name**: "Rujuk Kawan" (sub "Jemput kawan sertai PrestasiPlus dan dapatkan syiling bonus"; V3 "🤝 Rujuk Kawan, Dapat Syiling!"). **Route**: `/gamification/referral`, share card `/gamification/kad-kongsi`. **Row**: 36. **Priority**: P2.
- **Current status**: V3 code plus WhatsApp/Telegram, 50 syiling to the referrer and 25 to the friend; V2 100 syiling per friend, count, bonus.
- **Outcome**: invite friends and earn coins.
- **Reference (V2 `gamifikasi-referral.blade.php`)**: own code and link with copy, reward rule (100 syiling per registered friend), count of friends and earned, bonus; empty "Belum ada kawan mendaftar melalui pautan anda. Kongsi pautan di atas untuk mula."
- **FRs**: FR-MUR-36-1 code and link are unique per pupil; copy and share buttons work. FR-MUR-36-2 a friend who registers with the code credits the reward to the referrer once per friend, amount 100 syiling per friend as in V2 (route `/gamification/referral`), configurable. FR-MUR-36-3 self-referral and duplicate registrations earn nothing. FR-MUR-36-4 the list shows count and total earned, not friends' names or e-mail. FR-MUR-36-5 empty state exact copy.
- **Data**: referrals (owner M14); registration (M01).
- **ACs**: AC-MUR-36-1 Given a friend registers with the code, then the referrer wallet rises by the configured amount once. AC-MUR-36-2 Given the pupil's own code, then no reward. AC-MUR-36-3 Given no friends, then the V2 empty text. AC-MUR-36-4 Given 375 px, then share buttons wrap.
- **Gap**: reward rule differs (data decision). **FD**: none. **Decided**: OQ-MUR-19 (section 6.1).

### R1-MUR-38 Kedai Hadiah DIGITAL
- **Action**: Complete
- **Screen specification (from V2)**: the V2 digital catalogue is the same data as the Kedai Hadiah page (R1-MUR-31, V2 route `/gamification/rewards`) and the "Kedai Hadiah Digital" block of the Syiling & Token hub (R1-MUR-28, eight gift cards with token prices); see the screen specification of those two modules for every label. The route `/cikgu/hadiah`, its title, layout and states are Not observed in V2 — follow FR-MUR-38-*. Note: V2 has no `/cikgu/hadiah` pupil page (`/cikgu` is a hidden Alesa route, E-18). PRD: one catalogue, two entry points (FD-MUR-33).
- **Current gap and root cause (change list)**: `GET /api/hadiah-digital/items` always returns `[]`; read the shared `rewards` catalogue (D113), so `/cikgu/hadiah` shows the catalogue of row 31.
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Category filter, Tebus, Tebusan Saya | as R1-MUR-31 | - | Semua | same shared catalogue and dialogs (B-054) | as R1-MUR-31 | - | `reward_redemptions` | rewards API |
  - Behaviour: `GET /api/hadiah-digital/items` always returns `[]` today; it reads the shared `rewards` catalogue (D113).
  - New requirements: FR-MUR-38-5 The hadiah-digital read returns the shared catalogue rows.
  - New acceptance criteria: AC-MUR-38-4 Given a gift in the shared catalogue, then it appears on `/cikgu/hadiah` and on `/gamification/rewards`.
- **Name**: "Kedai Hadiah DIGITAL" (V3 "🎁 Kedai Hadiah Digital"). **Route**: `/cikgu/hadiah`. **Row**: 38. **Priority**: P2.
- **Current status**: V3 category filter, "Tebusan Saya", "Tiada hadiah"; V2 shows the same digital catalogue through the rewards page.
- **Outcome**: redeem digital gifts (vouchers, game top-ups).
- **Reference**: same catalogue and redemption as Kedai Hadiah (31); V2 examples include game credit and mobile top-up categories.
- **FRs**: FR-MUR-38-1 the page is a view of the digital-gift catalogue with category filter. FR-MUR-38-2 redemption follows FR-MUR-31-2 and shares stock and token balance with row 31 (one wallet, one catalogue, no duplicate state). FR-MUR-38-3 "Tebusan Saya" lists own redemptions. FR-MUR-38-4 route `/cikgu/hadiah` is not blocked by the Alesa flag (D73 hides `/cikgu` chat only).
- **Data**: as row 31.
- **ACs**: AC-MUR-38-1 Given a gift redeemed here, then it appears under row 31 "Tebusan Saya" too and the token balance is the same. AC-MUR-38-2 Given Alesa hidden, then `/cikgu/hadiah` still opens. AC-MUR-38-3 Given 375 px, then filters wrap.
- **Gap**: `GET /api/hadiah-digital/items` always returns `[]`; read the shared `rewards` catalogue (D113). **FD**: FD-MUR-33 (one catalogue for rows 31 and 38). **Decided**: none needed.

### R1-MUR-39 Timeline Saya
- **Action**: Complete
- **Screen specification (from V2)** (route `/timeline`, browser title "Timeline Saya — PRESTASIPLUS"). Regions: (1) heading "📸 Timeline Saya" and sub "Aktiviti terkini anda — latihan, pencapaian & mata diperoleh"; (2) feed grouped by day: a day heading with the full date (V2 prints "Friday, 23 October 2026" in English: defect, V3 prints BM) and a short date badge ("23 Oct"); under it event rows, each with a title (observed "Selesai latihan Sains"), a detail line "{betul}/{n} betul · {p}% ketepatan" and the time (e.g. "8:06 PM"); (3) at the foot a card "Profil Awam Anda" with the public profile address of the pupil. Other event types (pencapaian, mata), the empty state, manual posts of V3, loading and error: Not observed in V2 — follow FR-MUR-39-* and FR-X6.
- **Confirmed in the screens (earlier review)**: Confirmed: "📸 Timeline Saya" / "Aktiviti terkini anda — latihan, pencapaian & mata diperoleh"; entries grouped by day (V2 prints "Friday, 23 October 2026" in English; PRD prints BM), each "Selesai latihan {Subjek}", "{betul}/{jumlah} betul · {x}% ketepatan", time "8:06 PM"; block "Profil Awam Anda" with the public link. The empty-state sentence is from the V2 view; a manual post ("Tambah Pencapaian") is not in the screens.
- **Current gap and root cause (change list; `TimelinePage.vue`)**: add the automatic entries from sessions, badges and level-ups to the manual post model; add the "Profil Awam Anda" block.
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | **Manual post form (D115, audit mn-3: V3 already implements the V1 form, so V3 wins; Exists in V3, Verify: `src/modules/m08-student-performance/pages/TimelineCreatePage.vue`, route `/timeline/create` in `routes/timeline.ts:25`)**: Tajuk (max 150, line 141), Kategori (required select, line 149; its options are the V3 list in that file), Tarikh, Kandungan (textarea, hint "Maks 2000 aksara", line 175-183), Gambar (`photos[]`, up to 5 photos each with an optional caption of max 200, lines 211-244) | form | per the V3 form | - | V3 limits above replace the earlier 500 characters and three types | server messages of the timeline API (BM) | - | post | timeline API |
  | Padam: see below | | | | | | | | | |
  | Padam | button + dialog B-056 | - | - | title `Padam catatan ini?`, body `Catatan ini akan dipadam secara kekal.`, buttons "Padam" (danger) / "Batal" (default focus) | - | own posts only | - | same |
  - New requirements: FR-MUR-39-6 (D115) A manual post follows the V3 form: Tajuk max 150, Kandungan max 2000, up to 5 photos with a caption of max 200; the earlier limit of 500 characters and the three types Cerita/Aktiviti/Pencapaian are dropped (V3 already builds the V1 form and V2 has no manual post, so V3 wins).
  - New acceptance criteria: AC-MUR-39-5 Given 2001 characters in Kandungan (pasted, bypassing the field limit), then the server refuses the post with a BM error under the field and nothing is saved.
- **Name**: "Timeline Saya" (sub "Aktiviti terkini anda — latihan, pencapaian & mata"; add "Tambah Pencapaian"). **Route**: `/timeline`, `/timeline/create` (V3 route; `/timeline/baru` was a typo, D115). **Row**: 39. **Priority**: P2.
- **Current status**: V3 manual posts (Cerita/Aktiviti/Pencapaian) with "Tambah Post"; V2 an automatic feed ("Selesai latihan Sains 0/40") with a public profile link.
- **Outcome**: a personal activity feed.
- **Reference (V2 `timeline.blade.php`)**: automatic entries from sessions, badges and points; "Tambah Pencapaian" for manual entries; empty "Belum ada aktiviti lagi. Mula buat latihan untuk mengisi timeline anda dengan pencapaian dan mata!"; public profile link.
- **FRs**: FR-MUR-39-1 the feed merges automatic entries (sessions, badges) and the pupil's manual posts, newest first (level-ups are not in R1: V3 has no level-up event; D115, D-F). FR-MUR-39-2 "Tambah Pencapaian" saves a post with a text limit and shows it. FR-MUR-39-3 the pupil can delete own manual posts. FR-MUR-39-4 posts are never shown on the anonymous public profile (privacy of minors, OQ-API-04; `posts` is always empty there); a manual post is visible to its owner on the timeline only. FR-MUR-39-5 empty state exact copy.
- **Data**: timeline (owner M08), sessions (M05), badges (M14).
- **ACs**: AC-MUR-39-1 Given a finished quiz, then an entry "Selesai latihan {subjek} {betul}/{jumlah}" appears. AC-MUR-39-2 Given a manual post, then it shows and can be deleted. AC-MUR-39-3 Given no activity, then the V2 empty text. AC-MUR-39-4 Given 375 px, then entries stack.
- **Gap**: model differs (manual only). **FD**: none. **Decided**: none needed.

### R1-MUR-40 Jemput Ibu Bapa
- **Action**: Keep
- **Screen specification (from V2)** (route `/jemput-ibu-bapa`, browser title "Jemput Ibu Bapa — PRESTASIPLUS"). Regions: (1) heading "Jemput Ibu Bapa 👨‍👩‍👧" and sub "Kongsi link ini dengan ibu bapa untuk pantau perkembangan anda"; (2) card "Link Jemputan" with the invite link, the text "Salin link ini dan hantar kepada ibu bapa anda melalui WhatsApp atau mesej." and three buttons "Salin" (copies the link), "Hantar via WhatsApp" (opens WhatsApp with the link) and "Jana Link Baru" (replaces the link by a new one; confirmation text: Not observed in V2 — follow FR-MUR-40-*); (3) card "Ibu Bapa Dihubungkan", empty (observed) 👨‍👩‍👧 "Belum ada ibu bapa dihubungkan" / "Hantar link jemputan di atas". Populated parent rows, loading and error: Not observed in V2 — follow FR-MUR-40-* and FR-X6.
- **Confirmed in the screens (earlier review)**: Confirmed: "Jemput Ibu Bapa 👨‍👩‍👧" / "Kongsi link ini dengan ibu bapa untuk pantau perkembangan anda"; "Link Jemputan" with "Salin link ini dan hantar kepada ibu bapa anda melalui WhatsApp atau mesej.", buttons "Salin", "Hantar via WhatsApp", "Jana Link Baru"; "Ibu Bapa Dihubungkan" with the empty "Belum ada ibu bapa dihubungkan" / "Hantar link jemputan di atas".
- **Current gap and root cause**: None. Verify the ACs only.
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Salin | button | - | - | copies the link | clipboard blocked: `Salin pautan secara manual.` | - | - | - |
  | Jana Link Baru | button + dialog B-056b | - | - | title `Jana pautan baharu?`, body `Pautan lama tidak akan berfungsi lagi. Ibu bapa yang sudah dihubungkan kekal.`, buttons "Jana Baharu" / "Batal" | - | - | new link; the old one is invalid | parent invite API |
  | Buang ibu bapa | button + dialog B-056c | - | - | title `Buang ibu bapa ini?`, body `{nama paparan} tidak lagi dapat memantau kemajuan anda.`, buttons "Buang" (danger) / "Batal" | - | - | - | same |
  - New requirements: FR-MUR-40-6 Parent consent is not built; the link only connects a parent for monitoring.
  - New acceptance criteria: AC-MUR-40-5 Given "Jana Link Baru" is confirmed, then the old link fails and connected parents remain.
  - **Parent accept page `/ibu-bapa/terima/:token` (D115, MX-1; Exists in V3, Verify; source `docs/requirements/urs/L45-jemput-ibu-bapa.md` FN-L45-2.1.1..2.2.3).** Public page, no sidebar, no pupil data before acceptance. Exists in V3 (reuse; do not rebuild): route `src/modules/m01-authentication/routes/parent-invite.ts:11`, page `src/modules/m01-authentication/pages/ParentInviteAcceptPage.vue`, cards `components/invite/InviteInvalidCard.vue` and `InviteValidCard.vue`, API `GET /api/parent-invites/:token` (preview, `viewer` = `guest` | `other` | `parent`) and `POST .../accept`, pupil side `src/modules/m02-users-schools/pages/JemputIbuBapaPage.vue`, public path allowed in `src/app/prototype-scope.ts:108`. States (exact copy, from the page): (1) loading: progress bar (`aria-label` "Memuatkan"); (2) unknown, replaced or inactive-pupil token (404): tab "Link Tidak Sah — PRESTASIPLUS", heading "Link Tidak Sah", "Link jemputan ini tidak sah atau telah tamat tempoh.", alert "Link ini mungkin telah tamat tempoh atau dibatalkan. Sila minta anak anda menghantar jemputan baharu.", buttons "Log Masuk" and "Laman Utama"; (3) load failure (not 404): generic load error with retry; (4) valid, guest: tab "Jemputan Ibu Bapa — PRESTASIPLUS", identity card (initials, eyebrow "Jemputan Ibu Bapa", "Anda dijemput untuk memantau kemajuan {nama pelajar}", school line), text "Untuk memantau kemajuan pembelajaran anak anda di PRESTASIPLUS, sila log masuk menggunakan akaun Ibu Bapa anda. Selepas log masuk, buka semula pautan jemputan ini untuk mengesahkan hubungan.", button "Log Masuk Sebagai Ibu Bapa" (to `/login`), note "Belum mempunyai akaun Ibu Bapa? Daftar akaun Ibu Bapa terlebih dahulu, kemudian buka semula pautan jemputan ini." (link to `/register`); the token is not carried through login or registration; (5) valid, signed in as a non-parent: "Anda kini log masuk sebagai akaun yang bukan Ibu Bapa. Untuk berhubung dengan pelajar ini, sila log keluar dan log masuk semula menggunakan akaun Ibu Bapa anda." and button "Log Keluar & Log Masuk Sebagai Ibu Bapa" (goes to `/logout`, no confirmation); (6) valid, signed in as a parent: the page links once on load (`POST .../accept`, idempotent per parent and pupil pair; a GET never links), shows "Menghubungkan" progress, then eyebrow "Berjaya Berhubung", "Anda kini berhubung dengan {nama pelajar}", success box "Akaun anda ({nama ibu bapa}) telah dihubungkan dengan pelajar ini. Anda kini boleh memantau kemajuan mereka." and button "Lihat Profil Kemajuan" (to `/pelajar/{id}`); an accept failure other than 404 keeps the valid card and shows the red alert with the generic error; (7) footer "Pautan jemputan ini dikongsi oleh {nama pelajar} melalui PRESTASIPLUS." Roles: `/jemput-ibu-bapa` is for a pupil only; any other signed-in role gets the 403 page (40 FR-X2-4); a guest is sent to `/login`. Pupil-side strings (verify in `JemputIbuBapaPage.vue`; add only if missing): "Salin" shows "Disalin!" for 2 seconds; after "Jana Link Baru" is confirmed the flash reads "Link jemputan baru telah dijana!"; loading and load-error states follow FR-X6.
  - FR-MUR-40-7 The accept page implements states (1) to (7) above. AC-MUR-40-6 Given an unknown token, then "Link Tidak Sah" shows with no pupil name. AC-MUR-40-7 Given a signed-in Murid opens a valid link, then the switch-account state shows, no link is created and "Log Keluar & Log Masuk Sebagai Ibu Bapa" ends on `/login`. AC-MUR-40-8 Given a signed-in parent opens a valid link, then the parent appears in the pupil's "Ibu Bapa Dihubungkan" list and "Lihat Profil Kemajuan" opens `/pelajar/{id}`; opening the link again creates no second row. AC-MUR-40-9 Given a guest opens a valid link, then only the pupil's first name and school line show (no class, e-mail or marks).
- **Name**: "Jemput Ibu Bapa" (sub "Kongsi link ini dengan ibu bapa untuk pantau perkembangan anda"). **Route**: `/jemput-ibu-bapa`, parent accept `/ibu-bapa/terima/:token`. **Row**: 40. **Priority**: P2.
- **Current status**: V3 same as V2 (link, Salin, WhatsApp, "Jana Link Baru", parent list).
- **Outcome**: let a parent link to the pupil.
- **Reference (V2 `jemput-ibu-bapa.blade.php`)**: invite link with copy, WhatsApp share, "Jana Link Baru" (invalidates the old link), list of linked parents; empty "Belum ada ibu bapa dihubungkan".
- **FRs**: FR-MUR-40-1 the link is unique per pupil and generates only for the pupil. FR-MUR-40-2 "Jana Link Baru" invalidates the previous link at once. FR-MUR-40-3 a parent who accepts is listed with display name; the pupil can remove a linked parent. FR-MUR-40-4 the link exposes no pupil data before acceptance. FR-MUR-40-5 empty state exact copy.
- **Data**: parent links (owner M18/M01); parent portal.
- **ACs**: AC-MUR-40-1 Given "Jana Link Baru", then the old link returns an invalid message. AC-MUR-40-2 Given a parent accepts, then they appear in the list. AC-MUR-40-3 Given an unaccepted link opened by anyone, then no pupil data shows. AC-MUR-40-4 Given 375 px, then buttons stack.
- **Gap**: none. **FD**: none. **Decided**: none needed.

### 3C. Shared sign-in screens used by pupils (login, register, reset): R1-MUR-AUTH
- **Action**: Complete (screens exist in code; this block is the first written specification)
- **End-to-end flow**: errors follow ERR-AUTH-01..09 and ERR-REQ-*.
- **Field & behaviour spec**
  | Label | Type | Req | Default | Options / source | Validation + exact BM error | Depends on | Stored as | API |
  |---|---|---|---|---|---|---|---|---|
  | Alamat Email / Nama Pengguna | text, placeholder "nama@email.com" | Ya | empty | trimmed, 1-254 | `Sila isi alamat e-mel atau nama pengguna.`; wrong login (never says which part): `E-mel/Nama pengguna atau kata laluan tidak sah.` in the alert above the form (ERR-AUTH-02) | - | - | login API (strict body: unknown keys = 422) |
  | Kata Laluan | password | Ya | empty | 1-200, never trimmed | `Sila isi kata laluan.` | - | - | same |
  | Ingat saya | checkbox | Tidak | unticked | unticked = session cookie; ticked = 30 days (R1 decision D113) | - | - | cookie lifetime | same |
  | Pilih Sekolah Anda | radio list, shown only after 422 AMBIGUOUS_USERNAME | Ya when shown | none | `details.schools` (name ascending) sent as `schoolId` | `Nama pengguna ini wujud di lebih daripada satu sekolah. Sila pilih sekolah anda.` (ERR-AUTH-05); identifier and password stay filled | - | - | same |
  | Log Masuk | button | - | - | label "Sedang Memasuki..." | 403 `Akaun anda tidak aktif atau telah digantung. Sila hubungi pentadbir.`; 403 `Sekolah anda belum diaktifkan oleh pentadbir. Sila hubungi pihak sekolah.`; 403 `Peranan ini tidak tersedia untuk akaun anda.`; 429 per ERR-AUTH-09: 5 failed attempts per 60 s, then `Cuba lagi dalam {n} saat.` with the button disabled | - | - | same |
  | Nama Penuh | text | Ya | empty | trimmed, max 255 | `Sila isi nama penuh.`; `Nama tidak boleh melebihi 255 aksara.` | - | `name` | register API |
  | Alamat Email | email | Ya | empty | unique, case-insensitive, max 255 | `Sila isi alamat e-mel.`; `Alamat e-mel tidak sah.`; `E-mel ini telah didaftarkan.` | - | `email` | same |
  | No. Telefon (Pilihan) | tel, placeholder "Cth: 0191234567" | Tidak | empty | pattern `^[0-9+\- ]{0,14}$` | `No. telefon tidak sah.` | - | `phone` | same |
  | Saya adalah... | 3 cards | Ya | Pelajar | OPT-ROLE-REG: Pelajar `student`, Guru `teacher`, Ibu Bapa `parent` | `Peranan tidak sah.` | - | `role` | same |
  | Pilih Tahap Anda (Ting. 1 to Ting. 5) | single-select tiles | Ya for a pupil | none | OPT-TINGKATAN, stored `grade = n + 6`; no Darjah tile; grade < 7 or > 11 refused | `Sila pilih tahap anda.`; `Tahap tidak sah.` | role = student | `grade` | same |
  | No. Kad Pengenalan (Pilihan) | text, hint "Dilindungi PDPA. Hanya 2 digit terakhir akan dipaparkan." | Tidak | empty | 12 digits, with or without "-"; write-only, never returned | `No. kad pengenalan tidak sah.` | pupil | stored protected | same |
  | Negeri | select | Tidak | placeholder "Negeri" | OPT-NEGERI | - | - | filters the school search | schools API |
  | Sekolah | typeahead "Taip nama sekolah..." | Tidak for a pupil | empty | `GET /api/schools/search?state=&q=` from 2 characters, 20 results, name ascending | `Sekolah dipilih tidak sah.`; no result `Sekolah tidak dijumpai.` | Negeri | `schoolId` | same |
  | Kata Laluan / Sahkan Kata Laluan | password, hint "Minimum 8 aksara" | Ya | empty | min 8, max 200 (K1) | `Kata laluan mestilah sekurang-kurangnya 8 aksara.`; `Sila isi kata laluan.`; `Pengesahan kata laluan tidak sepadan.` | - | password hash | same |
  | Reset: Email | email | Ya | empty | same answer for known and unknown e-mail; one request per e-mail per 60 s; the token lasts 60 minutes and is single use | `Jika e-mel ini berdaftar, pautan tetapan semula kata laluan telah dihantar.`; 429 `Sila tunggu sebelum mencuba semula.` | - | - | reset API |
  | Reset by IC: Email + No. Kad Pengenalan | email, text | Ya both | empty | limit 5 per 15 minutes | `E-mel atau No. Kad Pengenalan tidak sepadan.`; `Terlalu banyak percubaan. Sila cuba lagi dalam 15 minit.` | - | - | same |
  | Reset: new password + confirm | password x2 | Ya | empty | token from the link; the rule of Kata Laluan | invalid token `Pautan tetapan semula tidak sah atau telah tamat tempoh.`; after success a session is issued and the flash reads `Kata laluan anda telah ditetapkan semula.` | - | - | same |
  - **Reset by e-mail, Fix (D115, rule b: V2 sends the e-mail; matrix audit banned-string finding).** V3 today shows the placeholder `Pautan reset melalui email belum tersedia. Guna Reset Melalui No IC, atau minta guru / admin sekolah anda menetapkan semula kata laluan.` (`src/modules/m01-authentication/pages/PasswordForgotPage.vue:25`). It contains the banned phrase "belum tersedia" (40 AC-X2-3) and is NOT added to the allow-list table X2-3-A. Change: the e-mail form of `PasswordForgotPage.vue` calls the reset API and shows the row "Reset: Email" above (same answer for a known and an unknown e-mail, 429 text, 60-minute single-use token); the placeholder constant and its text are deleted; "Reset Melalui No IC" stays as the second route. Owner card: S5-T05 (M01 registration and sign-in screens). Dependency to confirm in its gap check: a mail transport must exist on the server (none was found in `apps/api/src` on 2026-11-04); if absent, the e-mail account is configured by the UAT developer as an Ops task and the card is blocked on it, never shipped with the placeholder.
  - FR-MUR-AUTH-1 Every message above is BM; no Laravel English text reaches the pupil (K7). FR-MUR-AUTH-2 The password minimum is 8 where a password is set; login accepts any non-empty password. FR-MUR-AUTH-3 A teacher registration answers `Pendaftaran diterima. Akaun guru anda akan diaktifkan selepas disahkan oleh pentadbir sekolah.`. FR-MUR-AUTH-4 An unknown referral code on registration is ignored silently; the referral link is `/register?ref={code}` (V3 keeps the code in `sessionStorage` `pp.pendingRef` and sends it as `referralCode`, `src/modules/m01-authentication/lib/pending-ref.ts`; the form has no referral field; D115, 48 GAME-24).
  - AC-MUR-AUTH-1 Given a 7-character password on registration, then `Kata laluan mestilah sekurang-kurangnya 8 aksara.` shows under the field and the typed values stay. AC-MUR-AUTH-2 Given a wrong password, then the alert reads `E-mel/Nama pengguna atau kata laluan tidak sah.` and the password field is cleared. AC-MUR-AUTH-3 Given a reset request for an unknown e-mail, then the answer is the same sentence as for a known one. AC-MUR-AUTH-4 Given a pupil registers with Ting. 4, then `users.grade` is 10.

---

## 4. Cross-module rules for students

### 4.1 Level gating (D72/D96, amended by D101)
- Levels are Tingkatan 1-5. Darjah D1-D6 are inactive and never shown (picker, chip, count, chart, copy). UAT today still has 11 active levels (Darjah active): it must be switched to 5 for the Murid portal (admin/data action, tracked in the admin PRD).
- **D101 (2026-11-04): T1-T3 pupils get practice like V2.** Latih Tubi, Soalan by Chapter, Topik and Peta Belajar serve T1-T5 wherever servable questions (or chapters/topics) exist. The "Kandungan ... akan datang" level gate is removed. A pupil sees the levels and subjects of their own form first; a level or subject with no content shows a data empty state, never a "coming soon" notice.
- Where a feature depends on DSKP nodes (Analitik map, SP tags), only T4-T5 nodes are loaded (U1); a T1-T3 pupil sees the same screens with "Belum cuba" tiles and no SP map for their form; questions of T1-T3 can be approved without DSKP tags (U1) and are served.
- This amends the earlier reading of D72(2) ("learning content stays focused on Tingkatan 4-5") and resolves the observed gap (a T1 pupil saw "akan datang"). Code to change is listed in 4.11.

### 4.2 Counts per surface (D91)
Every number shown (card, hub tile, "Subjek Tersedia", index "soalan chapter", "Jumlah Soalan") uses the same rule as what the surface can draw: card = details = drawable. Drills (Databank, Latih Tubi, Soalan by Chapter) serve MCQ questions including figure questions and whole stimulus groups (D105, which supersedes the `group_id IS NULL` rule of D91/D92), so their counts include group members. A question that no surface can serve (missing figure, unbuilt mode, archived) is counted nowhere and the admin sees the reason. The login "N+ Soalan" counts every servable question in any activity. No seed or total is tuned to make counts agree.

### 4.3 Data privacy
- A pupil reads only own data: profile, wallet, sessions, answers, reports, headcount, performance. Another id returns 404/403 with no existence leak.
- Never shown to a pupil: school, class or teacher aggregates (Prestasi Dashboard Sekolah, Prestasi Guru, GPS), other pupils' attempts, e-mail or phone of other users, source PDFs of questions (AC-17.4), the answer key before "Semak" or Hantar.
- **Display name** = the pupil's first given name only, with no surname and no school. It is the only name another pupil ever sees: Kelas Saya, Kedudukan, Papan Pendahulu, game rooms, public profile and any shared list. The full name is shown only to the pupil, the pupil's own teachers, the school admin and Admin Pusat. Class lists show display name and syiling only. The public profile shows display name, tiles and the line of FR-MUR-A1-5 (no school, bio or cita-cita).
- Pupils are minors: real names never appear in docs, seeds or screenshots in the repo.
- Report text and pupil data are never sent to AI services.

### 4.4 Rewards (D97, D94, D-A11)
- **Terminology (one meaning, same as 48 section 1).** "Mata" is the pupil-facing word for XP: every pupil screen and message prints "mata" (never "XP"); this document and the API use "XP" in technical text, and "mata" in quoted UI copy. "Syiling" is the coin (pill "Koin" in the header, wallet balance "Syiling"). "Mata" never means marks (marks are "markah").
- **The Syiling rate is an admin setting, never a constant.** It is the setting "Syiling flat / soalan betul" of Kawalan Reward (R1-ADM-P2-09, API-ADM-16 `flatCoins`); its default is the V2 observed value **1**; a drill reads the rate once, when the session ends ("Tamat"), and credits that session at that rate (46 section 3.6); a sitting reads it at "Hantar". A change of the setting applies to sessions that end after it. The rate is read through the helper `coinsPerCorrect()`, which reads the `reward_settings` row when it exists and returns 1 when it does not. A mode-specific constant in code (for example the mission rate 3 or the V2 `SYILING_PER_CORRECT = 2`) is replaced by the setting. XP stays 10 per correct unit (V2 `XP_PER_CORRECT = 10`). Level = floor(XP/1000)+1.

| Source | Syiling | XP |
|---|---|---|
| Latih Tubi, Soalan by Chapter, Databank, Tracking A, Remedial / Ulang Kaji, Misi Harian (per-answer part, see below), Set Soalan Guru (`question_set`), PKSK | rate x correct units | 10 per correct unit |
| Bijak / Simulasi / Kertas Subjektif (rules below) | rate x marks | 10 per mark |
| Soalan Berstruktur (B6) | rate x awarded marks, paid once per set: only the gain over the highest total already paid for the same set (the highest `coins_awarded` of the pupil's earlier submitted attempts of that set; no new column) | 10 per mark gained |
| Games | only when "Mini-games beri syiling?" = Ya (V2 value "Tidak (XP sahaja)"); then rate x correct | 10 per correct unit |

- **Misi Harian (N-2):** per-answer Syiling = the admin rate (default 1), like every other mode. The mission's teacher-set `rewardCoins` (API-GUR-11) is paid once, when the pupil reaches the mission target (idempotent per pupil and mission). Example: rate 1, mission `rewardCoins` 10, target 5: 5 correct answers give 5 + 10 = 15 Syiling (AC-GUR-2b-5). **Fix:** the code constant `MISSION_COINS_PER_CORRECT = 3` is removed (`apps/api/src/modules/practice/rules.ts:50` and its use at line 61, `start.planner.ts:317`, `ports.ts:133`; mock copies in `src/modules/m05-practice/mock/datasets/pins.ts:91,99`, `mock/repository/start.ts:286`, `mock/repository/practice.ts:456`); the mission path uses the same rate lookup as the other modes.
- Example: rate 1, 7 of 10 correct = 7 Syiling + 70 XP; the admin sets rate 3, the next 7 of 10 = 21 Syiling + 70 XP (AC-MUR-16-4).
- Bijak: every submitted attempt earns the rate in Syiling + 10 XP per mark, no per-paper cap; "Cuba Lagi" earns again; self-mark adds the rate + 10 XP per mark gained (positive delta only, once per part, never above part marks, no claw-back); resubmit never double-awards. "Simulasi — Kuiz" "✓ Semak" writes no session and no answer row (V2 verified) and consumes no trial check; only the final submit of the kuiz writes the answers (FR-MUR-13-16).
- Streak (kombo): first activity 1; same day unchanged; next day +1; gap resets to 1. Header pills and Dashboard read the same wallet.

### 4.4a Games and gamification (normative text: 48; D113)
The normative text for every game and mechanic is `48-game-and-gamification-spec.md`. The Murid modules map to it as follows and keep only their module fields: R1-MUR-21 Permainan = GAME-00, GAME-01 (Battle Arena), GAME-R and GAME-02..07 (room games), GAME-S and GAME-08..12 (solo mini-games), GAME-13 (Jutawan Ilmu), GAME-14 (Roda Nasib), GAME-16 (Ranking Sekolah, Sekolah Bersaing); R1-MUR-23 = GAME-15 (Liga and Tournament); R1-MUR-18 and R1-MUR-33 = GAME-16; R1-MUR-28 = GAME-17; R1-MUR-29 = GAME-18; R1-MUR-30 = GAME-19; Misi Harian (Dashboard widget) = GAME-20; R1-MUR-31 and R1-MUR-38 = GAME-21; R1-MUR-22 = GAME-22; R1-MUR-35 = GAME-23; R1-MUR-36 = GAME-24; R1-MUR-34 = GAME-25.

Decisions applied here (48 section 1): real pupils first, then a clearly labelled "Robot PrestasiPlus" after 30 s without a human opponent, never a real pupil identity, never in standings, badges or leagues; game coins are the admin setting `games_award_syiling`, default off (XP only), with daily caps; Liga is enrolled by Admin Pusat only (no Guru or Admin Sekolah menu); parent consent is not built; the Syiling rate (default 1) and the referral reward (100) are admin settings; every game that shows bank questions writes each answer to `practice_answers` with its game mode (D113-b); a game never creates a "Sesi Kuiz" (D-PA-18). AC-CHAIN-10 (46 section 9.7) is the end-to-end proof that Kuiz and game answers reach every report.

### 4.5 Question reporting (D98)
See R1-MUR-54: only from own attempt or session, never auto-deactivates, admin decides (Arkib/Tolak), re-report never undoes a dismiss, per-pupil daily cap. A report of a Bijak question stores question and paper (AC-R1-18.1). Soalan by Chapter has no lock (D98).

### 4.6 Question display and answer contract (user correction 2026-11-04)
Sources: `v2-exam-schema.md` (D46/D47), `v2-question-bank.md` 4.10 and US-22 to US-26, `v2-question-bank-oldsystem-findings.md`, D41, D90, D97, D105. V2 supplies navigation, flow, timers, results layout and BM copy only.

1. **Structure**: a question is a tree of parts (depth at most 3: (a), (i), (A)); only leaf parts carry marks and an answer mode; the question total is the sum of leaf marks. Every leaf shows its label, prompt and "[{n} markah]". Group, stimulus and part order are as published.
2. **One question at a time** (full screen): progress bar and counter, subject chip, question text, answer area, "Semak" (disabled until an answer exists), feedback, "Teruskan". A very long stem or option scrolls inside the question area and the action stays reachable. In Bijak the paper keeps its Bahagian structure and the question map (Dijawab, Ditanda, Belum).
3. **Eleven served item kinds = the 9 leaf answer modes (OPT-MOD-JAWAPAN) plus 2 views of leaf mode `mcq`** (`true_false` and `mcq_multi` are question types; their leaves use leaf mode `mcq`, with two fixed options Betul/Salah for `true_false` and `multi: true` with key field `correctOptionIds: Id[]` for `mcq_multi`); they are NOT the 11 question types: the `questionType` values are the master list OPT-JENIS-SOALAN of 40 (`mcq`, `mcq_multi`, `true_false`, `match`, `short_answer`, `fill_blank`, `structured`, `working`, `essay`, `drawing`, `table_fill`), and `short_text` and `numeric` are leaf modes of `short_answer` (L-1, 40 X11 mapping table). (D113; schema D1/D2 plus `true_false`, `mcq_multi` and `essay_choice`; `drawing`, `table_fill` and `essay_choice` are served, which withdraws the earlier P2 / "not served" wording and K17):

| Mode | Pupil answers with | Marked |
|---|---|---|
| `mcq` (2 to 8 options A..H, default 4, one correct; MCQ minimum is 2, K12) | tap an option, whole option is the target; text, maths, image allowed | auto, server |
| `match_letter` | one picker per gap or item over one shared lettered option bank (not repeated per part) | auto, all-or-nothing per item |
| `short_text` | one text field, or one per blank when `blank_count` is set | auto with equivalence normalisation; a miss goes to review, never silently 0 |
| `numeric` | number with unit; unit and decimals or significant figures are checked | auto with tolerance |
| `working` | step lines with a maths keyboard in "Ruang kerja", a separate final-answer box "Jawapan:" with unit, photo-of-working fallback (D41-2) | final answer auto; method points by equivalence, uncertain ones suggested for confirmation |
| `essay` | long text with live word count; optional word range; alternative prompts | never auto-marked; the system may suggest a band and notes, the pupil self-marks (a person confirms) |
| `true_false` | two fixed options A "Betul", B "Salah" | auto, server (as `mcq`) |
| `mcq_multi` (2 to 8 options, k correct with 1 <= k <= n-1) | tick every correct option; helper line `Pilih semua jawapan yang betul.`; served in Bijak, Berstruktur, Kertas Subjektif and Set Soalan, NOT in single-option drills (D-PA-6) | auto: c correct ticked, w wrong ticked; marks 1: full only when c = k and w = 0; marks > 1: max(0, floor(marks x (c - w) / k)); ticking every option scores 0 |
| `drawing` | on-screen answer (or a photo of the drawn answer, JPG or PNG up to 5 MB, 3 per part) | checklist points of the scheme, self-marked (D-PA-4) |
| `table_fill` | grid with input in blank cells, answered on screen | each blank cell is a leaf part marked like `short_text` or `numeric`; partial credit = sum of cells; reveal shows the scheme and the pupil can adjust by self-mark (D-PA-4) |
| `essay_choice` | "Pilih satu daripada {n} gesaan", then the essay control | as `essay` for the chosen prompt (the chosen topic must belong to the part: `Tajuk yang dipilih tiada pada bahagian ini.`) |

   The section rule "Pilih N" stays for choosing among questions (D5). The V2 modes with 0 rows (`numbered_list`, `sequence_order`, `code`, `cloze`, `gapped_text_match`, `graph_plot`, `draw_on_diagram` canvas) are not built. A question whose mode or stimulus kind is not yet built is **not served** and the admin sees "Dilihat murid di" with the reason; the pupil never sees a partial or unanswerable part (supersedes the V2 fallback "Jenis jawapan ini akan tersedia tidak lama lagi.").
4. **Stimulus**: stored once, referenced by questions, parts and groups. A stimulus group is **one stimulus with N member questions** and is never a question of its own (D90): shown once, above or beside all its members; below 1024 px a chip "Lihat {label}" opens it and keeps it one action away; from 1024 px it is pinned while any member shows. Kinds served in Bijak/Kuiz: passage, image, diagram, table, map, infographic, graph; kinds outside this list exclude the question. Figures scale to the viewport, tap to enlarge, carry alt text; a missing asset blocks serving (AC-24.4). Maths renders formatted (no raw `$`), wide formulas scroll inside their container; Jawi/Arabic renders right-to-left with the option label position unchanged.
5. **Marking and review**: objective parts are graded on the server only (the key and `is_correct` never reach the page before the check); marks are per part. Scheme is revealed only after submit (Bijak) or after "Semak" (drills): correct option or accepted values, per-point hit or miss for structured schemes (codes such as K, N, P, M, F, C and bands per the schema), model answer or band rubric, explanation when present. Automatic marks for working, short and essay parts are **suggestions**; the pupil self-marks and "a failure never awards 0" (the pupil can always adjust). The V2 keyword matcher (single words of 5+ letters, any hit counts) is not the marking rule; it may only seed a labelled suggestion "Cadangan automatik" until structured points exist (FD-MUR-22).
6. **Per-surface scope** (D105 supersedes the text-only restriction of D92/D87 U2): Databank, Latih Tubi and Soalan by Chapter are MCQ lanes; they serve figure questions and whole stimulus groups (figure shown once, group never split, D90). Games (Battle and room games) are the exception: they serve only standalone text-only MCQ, never a stimulus group, a figure or an option image (servability activity `permainan`, R1-MUR-21, 46 section 5.1, 48 GAME-00 section 3.2). Bijak, Simulasi, Kuiz, Subjektif and Kertas Subjektif serve all modes and stimuli per items 3 and 4. A question whose stimulus is missing, or whose mode a surface cannot render, is excluded on that surface with an admin-visible reason and counted accordingly (D91).
7. **Option order**: Bijak keeps stored order and letters; drills shuffle and re-letter per session (V2/V1 behaviour, copy "🔀 Soalan dan pilihan jawapan dirawak setiap sesi."); the server maps back to the stored option.
8. **Autosave and safety**: answers autosave (800 ms debounce, local mirror, server wins on load); Hantar is idempotent; a timer is UX only.

### 4.7 Consolidated fidelity deviations (V3 differs from V2/V1 on purpose)

| ID | Module | V2/V1 behaviour | PRD behaviour | Reason and source |
|---|---|---|---|---|
| FD-MUR-1 | 3, 4 | Page heading "Dashboard"/"Selamat datang kembali" on Headcount and V1 Prestasi | Own title ("Headcount", "Prestasi Saya") | Wrong title (D9) |
| FD-MUR-2 | 3 | Pupil detail shows Auto-Setup and delete of headcounts | Read only | Pupil must not create or delete teacher data (D9 unsafe control) |
| FD-MUR-3 | 4, 6 | V1: pupil sees own-school dashboard; V3 API lets pupil call item-analysis school | Own data only; school scopes 403 | Privacy, V2 shows own 360 |
| FD-MUR-5 | A1, 2 | Dashboard level = XP/100, wallet level = XP/1000 | One formula (XP/1000) | Contradictory rule (D9); OQ-MUR-8 |
| FD-MUR-6 | A1 | Public profile shows the full name and school (V2) | First name only, no school, no bio, cita-cita or posts | Minors' privacy (OQ-API-04, decided 2026-11-04) |
| FD-MUR-7 | A2 | Note "Halaman ini hanya menunjukkan data dalam mod demo." | Replaced by help text | Demo leftover, wrong label |
| FD-MUR-8 | A3 | "Darjah 1-Tingkatan 5" | "Tingkatan 1 – Tingkatan 5" | D72 |
| FD-MUR-9 | 2 | "Pakej Soalan Biasa", validity today+1 year hard-coded | Real package or hidden | Fake data |
| FD-MUR-10 | 2 | 3 hard-coded missions | Real challenge progress | Wrong logic ("5 kuiz" done at 1 session) |
| FD-MUR-11 | 2, 4 | Hero accuracy = mean of session accuracy; card = correct/total | correct/total everywhere | Contradictory figures on one page |
| FD-MUR-12 | 5 | V2 note that trend and grade projection are unavailable | Keep V3 trend and projection | V3 exceeds V2, working |
| FD-MUR-13 | 7 | Zero-count pill links to `#` | Disabled pill | Dead link |
| FD-MUR-14 | 8 | (withdrawn) | Buttons shown, targets are modules of the rest of the matrix delivered with 1.0 | D100, D106 |
| FD-MUR-15 | 9 | 70% unlock sentences (V1 enforced, V2 copy only) | No lock, no 70% copy | D98 |
| FD-MUR-16 | 9 | Chapters from legacy `chapter_id` (0 rows) | Bab chosen by admin | D89 |
| FD-MUR-17 | 9, 16 | Drills include any status not "menunggu"; stimulus not grouped | Approved MCQ only; figure questions and whole groups served, figure once | D105, D90, D91 |
| FD-MUR-18 | 13 | "Tahun Tersedia" constant 0 | Computed or hidden | Broken stat |
| FD-MUR-19 | 13 | Subjektif "disemak oleh guru" | "Latihan soalan berstruktur & esei, semak sendiri dengan skema." (copy decided by D113) | Wrong label: marking is self-mark |
| FD-MUR-20 | 13 | No practice mode | "Mod Latihan" kept | V3 addition, not broken (v2-parity B02) |
| FD-MUR-21 | 13 | Printed-sheet pages, "Halaman X daripada Y" | One question or group per screen, same nav words | Schema 4.10, D28c/D44 |
| FD-MUR-22 | 13, 4.6 | Keyword-match suggestion, 8 modes without widgets | Structured scheme, equivalence, schema modes | User correction, findings doc section D |
| FD-MUR-23 | 13 | Stimulus repeated or pinned only section-wide | Stimulus group shown once | D90, findings A |
| FD-MUR-24 | 13 | Per-page auto-mark text "tanda automatik setiap halaman" in V2 listing | Removed | Stale copy (per-page mark removed in V2) |
| FD-MUR-25 | 14 | Tile links to generic `/practice/chapter` | Link to the chapter | Dead-end link |
| FD-MUR-26 | 16 | Correct flag in the page JSON, browser decides | Server grades | Findings "server-trust model" |
| FD-MUR-27 | 21 | Games draw "not menunggu", Battle approved only | Approved only | Consistency D90/D91 |
| FD-MUR-28 | 54 | V1 shows success on failure | Error state | Wrong message |
| FD-MUR-29 | 54 | "dinyahaktifkan sementara" | Removed | D98 |
| FD-MUR-34 | 54 | Five counters; legacy status "Selesai" | Five counters kept; "Dikeluarkan" is a card badge counted under "Diperbaiki"; no "Selesai" | Counters must add up; v2-question-bank US-19/20 (D113) |
| FD-MUR-35 | 2, 30 | Difficulty printed "easy/medium/hard" and "EASY/MEDIUM/HARD" with "MUDAH"; dates and relative times in English ("Tuesday, 3 November 2026", "8 months ago", "8:06 PM") | BM labels "Mudah/Sederhana/Sukar", BM dates and relative times | Wrong language labels (D9); V2 routes `/dashboard`, `/gamification/challenges`, `/timeline` |
| FD-MUR-36 | 12 | "Latihan Pemulihan" opens a drill that says there are no wrong questions | A card is listed only when its drill has questions | Contradictory states (D9); V2 routes `/remedial/saya`, `/practice/revision/:id` |
| FD-MUR-37 | A3 | Step 4 "Masuk Kelas": "Minta kod kelas daripada guru anda dan masukkan untuk sertai kelas." | "Minta guru anda menambah nama anda ke dalam kelas." (copy decided by D113) | Contradictory rule (D9): V2's own Kelas Saya has no code box and says the teacher adds the pupil (D-A8) |
| FD-MUR-38 | 6, 12 | Analisa Item tile and Remedial card show one decimal ("0.0%"); Remedial uses the mean of session accuracy | Whole-number percent; pooled accuracy | One computation and one precision per metric (D-A10); Dashboard, Profil and Prestasi observed whole numbers |
| FD-MUR-30 | 9, 16, 24, 25 | V3 gate "Kandungan akan datang" for T1-T3 | Gate removed; T1-T5 served | D101 (user, 2026-11-04); V2 serves all forms |
| FD-MUR-31 | 19 | V2 PKSK page lists only, no answering flow found | Full answer flow with result | D100 (no stub in a ticked module); V1 M07 |
| FD-MUR-32 | 22 | V2 disabled button "Pembelian tiket belum tersedia" | Working ticket purchase | D100 |
| FD-MUR-33 | 31, 38 | Two catalogues in V3 (`/gamification/rewards`, `/cikgu/hadiah`) | One catalogue, two entry points | Contradictory duplicate state (D9) |

### 4.8 Question-paper experience contract (stimulus groups and responsive)

Applies to Bijak SPM / Simulasi sitting, Simulasi — Kuiz, Latih Tubi, Soalan by Chapter, Databank, Tracking A, Subjektif, Remedial and Analisa Item drills, and every result and review screen. Sources: D90, D91, D105, `v2-question-bank-oldsystem-findings.md` section A, `v2-exam-schema.md` D6, X6.1 of `40-cross-cutting.md`. The root fault of V1 and V2: a diagram, passage or table became a standalone "question" and the questions that cite it were separated from it.

**Functional requirements**
- FR-MUR-QP-1 A stimulus (rajah, petikan, jadual, graph, map, infographic) is shown **once**, above all of its 1..n questions, in published order.
- FR-MUR-QP-2 The stimulus stays visible while the pupil answers each of those questions: pinned beside the questions from 1024 px; on phone and tablet below 1024 px a collapsible sticky panel (header "Lihat {label}", at most 42% of the viewport height when open) or toggle that never pushes the answer area off screen.
- FR-MUR-QP-3 A stimulus is never a separate numbered question, never counts in "Soalan {i} daripada {n}", the question map or the marks total, and never carries marks.
- FR-MUR-QP-4 A stimulus is never missing: a question that cites "Rajah n", "Jadual n" or "Petikan" without its stimulus asset is never served on any surface and the admin "Dilihat murid di" shows the reason; a stimulus whose file fails to load shows a retry control and blocks answering that group, never a blank gap.
- FR-MUR-QP-5 A stem is never shown twice (not in the stem and again in a part prompt, not as a duplicate paragraph); where the single part prompt repeats the stem, only one copy shows. Data with duplicated stems is flagged `stem_duplicated`, shown once and cleaned (FR-ADM-G7.6); it is not excluded from serving. A question whose figure is missing (`stimulus_missing`, `figure_only`) is excluded (FR-MUR-QP-4).
- FR-MUR-QP-6 A random draw (Latih Tubi, Databank, Chapter, Kuiz, Tracking A build, and the admin Jana Kertas) takes a whole group or nothing, keeps its order, and a target count is met by whole groups only.
- FR-MUR-QP-7 Every surface serves figure questions and whole stimulus groups (D105); where a surface cannot render a particular stimulus kind or answer mode, it excludes that question (never a partial group) with an admin-visible reason and its card, details and draw counts agree (D91).
- FR-MUR-QP-8 Phone stimulus panel: sticky under the top bar, open on the first member screen of each stimulus group and collapsed on that group's later member screens (header "Lihat {label}" visible; one tap opens it), and whatever state the pupil leaves is kept while moving between members of that group and on rotation (46 section 2.4); below 1024 px it never sits behind the on-screen keyboard.
- FR-MUR-QP-9 Zoomable figures: a figure fits the width by default; tap opens a full-screen viewer with pinch zoom, pan, double-tap, a visible close button at least 44 px and Back to close; alt text is announced; labels inside the figure stay legible at 2x; wide tables and equations scroll inside their own container.
- FR-MUR-QP-10 Answer inputs are full width; with the on-screen keyboard open the active field is scrolled into view above the keyboard using the visual viewport, the bottom action bar moves above the keyboard and does not cover the field; the maths keyboard (working mode) opens beside or above the field without covering the final-answer box; autosave runs on blur and on keyboard close.
- FR-MUR-QP-11 Sitting layout: a sticky top bar holds the timer ("Masa berbaki" or "Masa berlalu"), the save state and the mode badge; a bottom bar holds "Sebelum", the navigator button showing "{answered}/{total}" and "Seterusnya" and **"Hantar" at every width** (on the last question it is the primary action "Hantar Jawapan"); the navigator opens as a bottom sheet on phone (question numbers with state and a legend with colour keys and shapes) and as a side rail from 1024 px. Bars never cover the question or the stimulus panel.
- FR-MUR-QP-12 Rotation: switching portrait to landscape or back keeps the current question, scroll position, open stimulus panel, typed answers, selected option, timer value and navigator state; layout reflows without reload or loss.
- FR-MUR-QP-13 Quiz layout (Latih Tubi, Chapter, Databank, Remedial): one question per screen, "✓ Semak Jawapan" sticky at the bottom and reachable with a long stem, feedback and "Soalan Seterusnya →" below the options, "Lapor Soalan" in the question toolbar.
- FR-MUR-QP-14 Result and review (Semakan): on phone each part is a card with verdict, scheme block and self-mark stepper full width; the score "{score} / {max}" and per-Bahagian totals are visible without sideways scroll; the stimulus of the question is shown once above its member cards.
- FR-MUR-QP-15 Maths notation renders formatted at every width (matrix, fraction, power, root, unit), per FR-MUR-13-24.
- FR-MUR-QP-16 Navigator legend and status never rely on colour alone.
- FR-MUR-QP-17 Observed V3 problems to be fixed by these rules: 375 px missing "Hantar"; 375 px missing mode badge and a lone "Lapor Soalan" row; prose matrices; legend without colour keys at 1280; Sains T4 "Rajah 14/11/9/7" questions without figure and with duplicated stem, served in Latih Tubi; Latih Tubi banner still saying "Bab seterusnya terkunci sehingga bab semasa lengkap." (contradicts D98); at 1280 the Dashboard "Pilih rakan belajar" popup overlaps the banner carousel; the 1.0 sidebar on UAT lists non-1.0 items (Soalan Berstruktur, Kedudukan, PKSK, Artikel, Video group) and its list is cut off without a visible scroll cue.

**Acceptance criteria**
- AC-MUR-QP-1 Given a Bijak paper with one figure and questions 5, 6 and 7 citing it, when the pupil opens question 5, then the figure appears once above the questions of its group and is not repeated at questions 6 and 7.
- AC-MUR-QP-2 Given the same group at 375 px, when the pupil answers question 6, then the figure is available in the sticky panel "Lihat Rajah 1" without scrolling back, and the answer input remains visible (AC-X6-2).
- AC-MUR-QP-3 Given a group, then the question counter and the map count only questions (3 not 4) and no marks are attached to the figure.
- AC-MUR-QP-4 Given an approved question that cites "Rajah 14" without a figure, when any surface builds a draw, then it is not served, and the admin list shows the reason.
- AC-MUR-QP-5 Given a stem stored twice, then the pupil sees it once and the admin sees the question flagged.
- AC-MUR-QP-6 Given a draw of 10 questions from a pool with groups of 3, then no group is split: each group appears whole in order or not at all.
- AC-MUR-QP-7 Given a Latih Tubi test subject with 50 single MCQs and one stimulus group of 3 members, then the card count is 53, the details view shows 53, and a draw of all questions serves 53 with the group whole; given the same subject where one member's figure asset is missing, then the whole group is excluded, the card shows 50 and the admin list names the reason.
- AC-MUR-QP-8 Given a figure at 375 px, when tapped, then a full-screen viewer opens, pinch-zoom works, and the close button (at least 44 px) or Back closes it.
- AC-MUR-QP-9 Given a working-mode part at 375 px with the keyboard open, then the final-answer field, the maths keys and "Hantar" are all reachable and none is hidden behind the keyboard.
- AC-MUR-QP-10 Given a sitting at 375, 768 and 1280 px, then timer, save state, navigator button and "Hantar" are visible and do not cover the question text.
- AC-MUR-QP-11 Given the sitting at 375 px, then the mode badge shows and "Lapor Soalan" is in the question toolbar.
- AC-MUR-QP-12 Given a matrix question, then it renders as a notation at the three widths (see AC-MUR-13-17).
- AC-MUR-QP-13 Given the navigator, then the legend shows colour keys and shapes at 1280 and in the bottom sheet at 375.
- AC-MUR-QP-14 Given a typed answer and an open stimulus panel, when the device rotates, then the question, answer, scroll, panel state and timer value are unchanged.
- AC-MUR-QP-15 Given a Latih Tubi question with a long stem at 375 px, then "✓ Semak" stays reachable and the page has no horizontal scroll.
- AC-MUR-QP-16 Given Semakan at 375 px for a group, then the figure shows once above its member cards, each card shows verdict and scheme, and the steppers are at least 44 px.
- AC-MUR-QP-17 Given the timer under 5 minutes, then the amber warning "Amaran: masa berbaki kurang 5 minit." shows in the top bar at every width without moving the question.

### 4.9 Responsive behaviour per module (375 / 768 / 1280)

Each row is also an acceptance criterion `AC-MUR-RS-n` (18 criteria, one per module row in table order) (given the module at the three widths, then the stated behaviour holds and AC-X6-1 passes with a screenshot per width).

**Measurable vocabulary for every responsive AC in this document** (so "Given 375 px, then ..." is testable). Test viewports: 375x667, 768x1024, 1280x800; the module is seeded with at least 3 records; "page loads" = network idle.
- "No sideways scroll" = `document.documentElement.scrollWidth <= window.innerWidth`.
- "N columns" = the number of distinct left offsets among sibling cards or tiles is N; "stack" = 1 column; "wrap" = children occupy at least 2 rows with none clipped.
- "Full width" = element width is at least 90% of its container's width.
- "Scrolls inside" = the element has `overflow-x` scroll or auto and the page has no sideways scroll.
- "Reachable" = the control's bounding box lies inside the visual viewport after at most one vertical scroll, with the on-screen keyboard open where a field is focused.
- "Tappable" = interactive element of at least 44x44 px with at least 8 px to its neighbour.
- Body text is at least 14 px on phone (FR-X6-2); captions and badges at least 12 px; nothing is truncated without a way to read it in full.
- "The V2 empty text" = the exact string quoted in that module's Reference.

| Module | 375 px | 768 px | 1280 px | AC |
|---|---|---|---|---|
| A1 Profil | one column; six tiles in 2 columns; sessions table scrolls inside its card; calendar wraps | tiles 3 columns | tiles 6 columns | AC-MUR-RS-1 |
| A2 Tetapan | rows stack label over value; password form one column | same, card centred | same | AC-MUR-RS-2 |
| A3 Panduan | role chooser wraps; steps stack | two-column steps | role chooser row | AC-MUR-RS-3 |
| A5 Log Keluar | in account menu and drawer, 44 px target | account menu | account menu | AC-MUR-RS-4 (same assertion as AC-MUR-A5-4) |
| 2 Dashboard | tiles 2 columns; right rail below; mascot/popups never overlap content | tiles 2-3 columns | main plus 300 px rail | AC-MUR-RS-5 |
| 3 Headcount | cards one column; checkpoint table scrolls inside; chart fits | 2 columns | 3 columns | AC-MUR-RS-6 |
| 4 Prestasi | cards 2 columns; 90-day map wraps; chart height 224 px | 4 cards in a row at 1024 | full layout | AC-MUR-RS-7 |
| 5 Analitik | tabs scroll horizontally in own bar; tiles wrap; ring above stats | ring beside stats | 3-column grid | AC-MUR-RS-8 |
| 6 Analisa Item | tiles 2 columns; item cards stack; filter chips wrap | tiles 2-4 | tiles 4 columns | AC-MUR-RS-9 |
| 7 Video | grid one column; pills scroll | 2 columns | 3-4 columns | AC-MUR-RS-10 |
| 8 Kelas Saya | classmates one column | 2 columns | 2 columns | AC-MUR-RS-11 |
| 9 Soalan by Chapter | subject cards one column; chapter rows stack title over buttons | 2 columns | 3 columns; quiz per 4.8 | AC-MUR-RS-12 |
| 12 Remedial | cards stack | same | same | AC-MUR-RS-13 |
| 13 SPM | hub cards one column; Kertas Pilihan filters stack; sitting per 4.8 (top bar, bottom bar with Hantar, navigator sheet, sticky stimulus panel) | 2-column hub; navigator side rail optional | pinned stimulus plus navigator rail | AC-MUR-RS-14 |
| 14 Heatmap | tiles 1-2 columns; legend wraps | 3 columns | auto-fill 200 px | AC-MUR-RS-15 |
| 16 Latih Tubi | subject cards one column; setup summary below options; quiz per 4.8 | 2 columns | 3 columns | AC-MUR-RS-16 |
| 21 Permainan | cards one column; board fits width; lobby forms one column | 2 columns | 3 columns | AC-MUR-RS-17 |
| 54 Laporan Soalan | counters 3 columns by 2 rows; dialog full width, 500-character counter visible above keyboard | counters 6 in a row | same | AC-MUR-RS-18 |

### 4.10 DSKP and curriculum level shown by each module

Facts: the DSKP tree (`curriculum_nodes`: Tajuk DSKP, SK, SP, TP; the word "Unit" is not used, and "Bab" always means the textbook chapter below) is loaded by `docs/ops/dskp-loader.md` from `docs/reference/dskp/*.json` for T4-T5 and is used for tagging, blueprints, Jana Kertas and analytics. Chapters (Bab) and topics are a **separate tree** (686 T4/T5 chapters on UAT); UAT had 0 `curriculum_nodes` and 0 question-to-chapter links (D89). The pupil never sees an unmapped label as if it were mapped.

| Module | Level displayed | Source | When not mapped |
|---|---|---|---|
| Soalan by Chapter (9) | Bab (textbook chapter) | admin-chosen Bab on each question (D89) | chapter listed with "Tiada soalan"; subject hidden when no chapter has a question: "Tiada subjek bab tersedia untuk tahap ini." |
| Heatmap Topik Lemah (14) | Bab tile (V2 unit) | Bab links | Per subject: Bab tiles when any approved question of the subject and Tingkatan has a Bab (SP ignored there); SP tiles only in a subject where no question has a Bab; empty state "Belum ada data heatmap." |
| Analitik Adaptif (5) | SP grouped by Tajuk DSKP and SK (Peta DSKP, TP shown as bands Mahir/Sederhana/Lemah) | question SP tags (`question_version_sp_nodes`) | tile "Belum cuba" for SPs with no tagged question; message "Belum ada latihan untuk {subjek}. Mula berlatih untuk membuka analitik penuh." |
| Prestasi (4) "Topik Perlu Perhatian" | topic: SP if tagged, else Bab | same | topic row omitted; subject rows still shown |
| Latih Tubi (16), Databank (13), Remedial (12) | subject and level only; chip "✓ Mengikut DSKP" only when the question has an SP tag | tags | untagged legacy questions stay servable (D80 Q-01), no chip |
| Bijak SPM (13) | blueprint units and TP quotas drive papers; pupil sees Bahagian and weak-topic summary on result | blueprint, tags | untagged questions are not placed in papers (D80) |
| Topik (24), Peta Belajar (25) | Topik: Bidang/Tajuk (textbook topic tree, chapters/topics); Peta Belajar: Bab islands with SP progress | chapter and topic trees; DSKP SP for progress where nodes exist | "Tiada topik buat masa ini" / "Peta Belum Tersedia" only as data-empty states per 3B; T1-T5 (D101) |

- FR-MUR-DK-1 Each module shows only the level in the table above and never mixes Bab and SP labels in one tile.
- FR-MUR-DK-2 No label, count or percentage is invented for unmapped content; unmapped questions are excluded from Bab, heatmap and SP analytics but remain in Latih Tubi and Databank when approved (D80 Q-01). "Unmapped" now means a legacy question published before the admin gate: a question cannot be published without Bab where its Subjek + Tingkatan has chapters, nor without SP and TP/aras where DSKP nodes exist for it (D-A5, D112(1)(3)), and the admin work-list "Soalan tanpa Bab" lists the legacy ones until they are tagged.
- FR-MUR-DK-3 Pupil copy for unmapped content uses the exact empty-state strings above; the admin-only wording "Belum ditanda DSKP" is not shown to pupils.
- FR-MUR-DK-4 DSKP text shown to the pupil is the printed text of the extracts (codes and wording unchanged); for the SPs flagged in the README (formulas as images, reconstructed Sains T4 4.3.1) the SP title is shown without relying on exact wording.
- FR-MUR-DK-5 DSKP SP/TP labels are shown only where nodes exist (T4-T5 today); T1-T3 screens work without them (D101) and Darjah nodes never appear (D72/D96).
- AC-MUR-DK-1 Given UAT with 0 Bab links, when a T5 pupil opens Soalan by Chapter, then no chapter is shown as having questions and the empty state shows (not a made-up count).
- AC-MUR-DK-2 Given a question tagged to SP 1.1.1 only, in a subject where other approved questions have a Bab, then it appears in Analitik under that SP and not in Heatmap Bab tiles; in a subject where no question has a Bab, then the Heatmap shows the SP tile.
- AC-MUR-DK-3 Given a question with a Bab and no SP, then it appears in Soalan by Chapter and the heatmap and not in the Analitik map.
- AC-MUR-DK-4 Given an untagged approved MCQ, then Latih Tubi and Databank serve it with no "✓ Mengikut DSKP" chip.

### 4.11 V3 "akan datang" / "belum tersedia" / prototype notices in matrix modules (gaps to fix, D100/D101)

| # | Where (file:line) | What the pupil sees | Module | Fix |
|---|---|---|---|---|
| 1 | `src/lib/lower-form.ts:6-10` (`LOWER_FORM_COPY`, `isLowerFormGrade` grade 7-9) | "Kandungan akan datang" / "Kandungan untuk Tingkatan anda akan datang. Buat masa ini, latihan tersedia untuk Tingkatan 4 dan 5." | 16, 9, 24, 25 | Delete the gate and the file (D101) |
| 2 | `src/modules/m05-practice/pages/PracticeListPage.vue:29,55-58` | the card above on Latih Tubi | 16 | remove `useIsLowerForm` branch |
| 3 | `src/modules/m05-practice/pages/ChapterIndexPage.vue:21,48-51` | same | 9 | remove branch |
| 4 | `src/modules/m03-curriculum/pages/TopicsPage.vue:32,50-53` | same | 24 | remove branch |
| 5 | `src/modules/m03-curriculum/pages/LearningMapPage.vue:30,50-53` | same | 25 | remove branch |
| 6 | `apps/api/src/modules/practice/rules.ts:40-45` (the T1-T3 "akan datang" gap is at lines 43-45) (`SPM_LEVEL_CODES`, `OFFERED_LEVEL_CODES` = T4, T5) | T1-T3 levels not offered in Latih Tubi setup | 16, 9 | offer T1-T5 |
| 7 | `src/app/prototype-scope.ts:8-9,52-59` and `src/pages/PrototypeUnavailablePage.vue:3` ("Belum Tersedia dalam Prototaip", "Skrin ini belum termasuk dalam skop prototaip ini...") | shown for any Murid route not listed in `STUDENT_ITEMS`, e.g. `/laporan-soalan` redirect to Dashboard | 54, 3, 6 and all rows | retire for Murid (FR-MUR-SH-9) |
| 8 | `src/app/router/guards.ts:139`; `src/shells/nav/user-nav.ts:749` `STUDENT_HIDDEN_IDS` (headcount, analisa-item, laporan-mingguan) | menu hidden, route refused | 3, 6 | remove ids for headcount and analisa-item |
| 9 | `src/modules/m28-bijak-spm/pages/ResultPage.vue:256` ("Semakan belum tersedia" + "Skema pemarkahan hanya dipaparkan selepas kertas dihantar.") | a state shown when the result is requested before submit | 13 | lock state only; ensure it shows only before submit, otherwise the result shows; the text stays: "Semakan belum tersedia" is an allow-list entry of 40 AC-X2-3, shown only on the result page requested before submit |
| 10 | `src/modules/m28-bijak-spm/pages/PaperQuizPage.vue:193` ("Kertas belum tersedia" + API line) | paper withdrawn or being updated (H-A13) | 13 | keep the state and the exact API line; "Kertas belum tersedia" is an allow-list entry of 40 AC-X2-3, shown only for a withdrawn or updating paper |
| 11 | `src/modules/m28-bijak-spm/lib/kuiz.ts:34` ("Skema jawapan belum tersedia untuk soalan ini.") | a Kuiz question without a scheme | 13 | a question without scheme is not served in Kuiz (4.6); the text is defensive only and stays as an allow-list entry of 40 AC-X2-3 ("Skema jawapan belum tersedia untuk soalan ini.", shown only if a Kuiz question without a scheme is reached) |
| 12 | `src/modules/m28-bijak-spm/server/errors.ts:14` and `server/http-admin.ts:153` ("Fungsi ini belum tersedia dalam demo") | demo server message | 13 (admin side) | must never reach a pupil; remove from the real path |
| 13 | UAT `GET /api/config/support` 404 | Panduan loads with an API error | A3 | seed the support row (admin settings) |
| 14 | Prestasi / Headcount / Analisa Item routes: 403 or redirect (see modules) | pupil blocked | 3, 4, 6 | per modules |

The banned strings and the single allow-list are defined only in 40 AC-X2-3 (master; plan table C, card S0-T04 and FAQ Q26 cite it and restate no other list); this table never restates them. Items 9 to 11 are lock or defensive states, not feature stubs; 1 to 8 and 13 are gaps. Owners: items 1 to 5 are removed together by card S5-T01 (it owns `lower-form.ts` and the four pages; FR-MUR-16-13 and AC-MUR-16-9 are verified on its PR); item 6 (`rules.ts`, found by the symbol names `SPM_LEVEL_CODES` and `OFFERED_LEVEL_CODES`) is changed by S4-T06 alone (its card line; S5-T03 does not touch level codes; FR-MUR-16-13 stays verified by S5-T01); item 7 by S0-T05, and items 8 and 14 by S0-T05, S0-T06 and S10-T01 to S10-T03 as the plan lists; no page keeps a copy of the gate.

---

## A1. Option sets used here

The master list of option sets is `40-cross-cutting.md` section X11 (merged from this file, 20 and 30; X11 wins on a difference). This file uses the sets below by ID; the values are those decided for R1 and are repeated only so a module block can be built without opening X11.

| Option set | Used on | Options in display order -> stored value |
|---|---|---|
| OPT-TINGKATAN | register, Latih Tubi, Chapter, Topik, Peta Belajar, Audio KBAT, Analitik | "Tingkatan 1".."Tingkatan 5" -> level code `T1`..`T5`, `users.grade` 7..11 (n + 6); short "Ting. n"; "Semua Tahap" -> `all` only where stated; no Darjah; default = the pupil's own form; only forms with servable content, with counts |
| OPT-SUBJEK | every subject picker, chip and tab | data source `subjects` (active) filtered by servable content for the pupil's form; Subjek Teras group first, then Elektif, name ascending; names are never hard-coded |
| OPT-KESUKARAN | Latih Tubi, Dashboard statistics | "Sangat Mudah" 1, "Mudah" 2, "Sederhana" 3, "Sukar" 4, "Sangat Sukar" 5; "Semua" = null; TP (1-6) is a separate admin field and is never shown to a pupil (OPT-TP) |
| OPT-BILANGAN-LT | Latih Tubi, Chapter, game rooms | 5, 10 (default), 15, 20 |
| OPT-BILANGAN-DB | Databank | 5, 10 (default), 20 |
| OPT-BILANGAN-KUIZ | Simulasi - Kuiz | 5, 10, 20 (default), 40 |
| OPT-ARAS-KBAT | Soalan Berstruktur | "LOTS 1" 1, "LOTS 2" 2, "MOTS 3" 3, "HOTS 4" 4, "HOTS 5" 5, "HOTS 6" 6 (`kbatLevel` = the Aras index in OPT-ARAS order: Mengingat 1, Memahami 2, Mengaplikasi 3, Menganalisis 4, Menilai 5, Mencipta 6; KBAT = Aras 3 to 6, so the badge KBAT shows for 3 to 6); the Bloom leaf level is admin only (K14) |
| OPT-KERTAS | Bijak, Kertas Subjektif | "Kertas {k}", k = 1, 2, 3, 4 (objective = 1) |
| OPT-MOD-JAWAPAN (9 leaf modes) plus the 2 `mcq` views = the eleven served item kinds (register ID OPT-QTYPE in 10 and 46; the question types are OPT-JENIS-SOALAN in 40 X11, a different list of 11 values) | answering, report | "Aneka pilihan" `mcq` (2-8 options); "Betul / Salah" `true_false`; "Aneka pilihan (lebih daripada satu jawapan)" `mcq_multi`; "Padanan huruf" `match_letter`; "Jawapan pendek" `short_text`; "Nombor" `numeric`; "Kerja & jawapan akhir" `working`; "Esei" `essay`; "Esei (pilih satu gesaan)" `essay_choice`; "Lukisan" `drawing`; "Isi jadual" `table_fill` (nine leaf modes plus `true_false` and `mcq_multi`: eleven served item kinds; `true_false` and `mcq_multi` are views of `mcq`, `short_text` and `numeric` are leaf modes, not question types) |
| OPT-MODE-SESI | Sejarah chips, A1 "Mod", Prestasi sessions | `latih_tubi` "Latih Tubi", `chapter` "Soalan by Chapter", `revision` "Ulang Kaji", `remedial` "Remedial", `databank` "Databank SPM" (legacy `past_year`, read-only), `tracking_a` "Tracking A" (legacy `ramalan`, read-only), `question_set` "Set Soalan Guru", `mission` "Misi Harian", `pksk` "PKSK", `random` "Latih Tubi Rawak", `kuiz` "Simulasi - Kuiz", `simulasi` "Bijak SPM", `subjektif` "Subjektif", `structured` "Soalan Berstruktur", `battle` "Battle", `game` "Permainan", `audio_kbat` "Audio KBAT"; these are 16 writable modes plus `random`, which is legacy read-only (the per-screen mapping is the master table in 40 next to OPT-MODE-SESI, which counts 16 writable values), and with the 2 legacy read-only values `past_year` and `ramalan` they are exactly the 19 values of the DM-44 check (D-53) |
| OPT-STATUS-LAPORAN | Laporan Soalan | `pending` Menunggu, `reviewed` Disemak, `fixed` Diperbaiki, `dismissed` Ditolak, `removed` Dikeluarkan |
| OPT-STATUS-TIKET | Tiket Bantuan | `dibuka` Dibuka, `dalam_proses` Dalam Proses, `menunggu_balas` Menunggu Balas, `selesai` Selesai, `ditutup` Ditutup |
| OPT-STATUS-ATTEMPT | Bijak | `in_progress` "Belum dihantar", `submitted` "Dihantar", `auto_submitted` "Dihantar automatik", `abandoned` "Ditinggalkan" |
| OPT-STATUS-BAHAGIAN | Semakan | `betul` "✓ Betul", `separa` "Separa", `salah` "✗ Salah", `kosong` "Tiada jawapan", `belum_dimarkah` "Belum dimarkah" (suffix "{a}/{m}") |
| OPT-STATUS-REDEEM | Kedai Hadiah | `pending_parent_consent` "Menunggu Ibu Bapa" (stored data only, K19), `pending_admin` "Menunggu", `delivered` "Dihantar", `cancelled` "Dibatalkan" |
| OPT-STATUS-HEADCOUNT | Headcount | card "Active" / "Draft"; chip "Auto" / "Manual"; status "On Track" / "Below" / "—" |
| OPT-REPORT-REASON-MCQ | report dialog | `wrong_answer` "Jawapan tidak tepat", `confusing_question` "Soalan mengelirukan", `wrong_options` "Set jawapan tidak tepat", `missing_options` "Pilihan jawapan tidak lengkap", `duplicate` "Soalan berulang / pendua", `typo` "Kesalahan ejaan / taip", `other` "Lain-lain" |
| OPT-REPORT-REASON-STRUCT | report dialog | `wrong_answer` "Skema jawapan tidak tepat", `confusing_question` "Soalan mengelirukan", `wrong_options` "Markah tidak adil", `typo` "Kesalahan ejaan / taip", `other` "Lain-lain" |
| OPT-PERIOD / OPT-SKOP | Papan Pendahulu | "Semua Masa" `all` (default), "Minggu Ini" `week`, "Bulan Ini" `month`; "Kelas" `kelas`, "Sekolah" `sekolah` |
| OPT-TIER / OPT-TUKAR | Syiling, Tukar Token | Gangsa 0+ 50:1, Perak 500+ 40:1, Emas 2,000+ 30:1, Platinum 5,000+ 20:1 (admin config); 50, 250, "Semua" |
| OPT-NEGERI / OPT-FAITH / OPT-ROLE-REG | register, Tetapan | the 16 states (stored as the full name); "— Tidak nyatakan —" null, Islam `muslim`, Hindu `hindu`, Buddha `buddhist`, Kristian `christian`, Tiada `none`; Pelajar `student`, Guru `teacher`, Ibu Bapa `parent` |
| OPT-KATEGORI-VIDEO / -ARTIKEL / -HADIAH | Video, Artikel, Kedai Hadiah | Semua, Motivasi, Tutorial, Tips SPM, Ceramah, Lain-lain; Semua, Berita, Kejayaan, Motivasi, Panduan Guru, Panduan Ibu Bapa, Tips Belajar, Umum; Semua, E-dagang, E-dompet, Makanan & Minuman, Permainan, Pembelajaran, Penstriman, Telco |
| OPT-RARITY | Pencapaian | Biasa, Jarang, Epik, Legenda |

OPT-MOOD is used by the mood check-in (FR-MUR-2-12, D114(b)): `happy`, `okay`, `sad`, `stressed`.

## A2. Data/API additions required

Each item is a need cited by an FR/AC of this file. Existing DM/API IDs are named where they exist in 50/60; the IDs in the last column are registered in 50/60.

| # | Need | Cited by | Existing ID |
|---|---|---|---|
| 1 | New column `users.aspiration` varchar(255) null; returned by `GET /api/me`, accepted by `PUT /api/me` (trim, blank clears); never in the public profile | FR-MUR-A1-10, AC-MUR-A1-9, AC-MUR-A1-10 | DM-80, API-AUTH-08, API-AUTH-09 |
| 2 | `users.bio` holds 1000 characters (migration if shorter); `ACCOUNT_BIO_MAX = 1000` | FR-MUR-A1-11, AC-MUR-A1-8 | DM-80, API-AUTH-09 |
| 3 | `PUT /api/me` is partial (every key optional, `name` 1-255 when present); for role student the server ignores `grade`, `schoolId` and `role` (200, stored values returned) | FR-MUR-A1-9, FR-MUR-A2-6, AC-MUR-A2-5 | API-AUTH-08, API-AUTH-09 |
| 4 | `ACCOUNT_PASSWORD_MIN = 8` for register, reset and change; login non-empty only | FR-MUR-A2-8, AC-MUR-A2-6, AC-MUR-AUTH-1 | API-AUTH-06, API-AUTH-07, API-AUTH-10 |
| 5 | BM message constants in the account contract (required, max, min, e-mail format, taken, current password wrong, reset token, reset sent, reset done, invalid school, invalid level) replacing Laravel English | FR-MUR-A2-7, FR-MUR-AUTH-1, AC-MUR-A2-8 | 60 section 1.4 (extended) |
| 6 | Helpers `gradeToLevelCode` and `levelCodeToGrade` (Tingkatan n -> `T{n}` -> `grade = n + 6`); register and admin edit reject a student `grade` below 7 or above 11 with `fields.grade` "Tahap tidak sah." | FR-MUR-AUTH-1, AC-MUR-AUTH-4 | API-AUTH-06 |
| 7 | `GET /api/leaderboard` is canonical; `period` absent or unknown = `all`; `GET /api/gamification/leaderboard` and the route `/gamification/leaderboard` removed (redirect for the route) | FR-MUR-33-5, FR-MUR-33-6, AC-MUR-33-5 | API-GAME-06, API-RPT-13 |
| 8 | Leaf kinds `true_false` and `mcq_multi`; answer key kind `options` = `{correctOptionIds: Id[]}` only (no `choices` or `choice` for it; the other key kinds keep their 45 section 7.0 fields); scheme kind `options` {correctOptionIds: Id[]}; reveal returns `correctOptionIds[]`; MCQ minimum 2 options | 4.6 item 3, AC-MUR-13-12 | DM-69, API-BIJAK-04, API-BIJAK-06, API-PRAC-02 |
| 9 | Serving of `drawing`, `table_fill` and `essay_choice` (serving filter lifted; capture widget and grid widget on the pupil side); `table_fill` stored as one leaf part per blank cell | 4.6 item 3, FR-MUR-13-12 | DM-69, DM-55, API-BIJAK-04, DM-44 (registry) |
| 10 | `selfMarkable` also for `accepted` parts left `belum_dimarkah` (K20) | FR-MUR-13-13, FR-MUR-13-29 | API-BIJAK-05 |
| 11 | `practice_answers.mode` registry: the 19 values of 50 section 4.7a; Soalan Berstruktur = `structured`, Battle = `battle`, other games = `game`; unique index includes `user_id` (replaces `spm_mock`, `spm_ramalan`) | FR-MUR-13-21, FR-MUR-17-3, FR-MUR-17-6, FR-MUR-21-8, AC-MUR-17-5 | DM-44 (50 section 4.7a) |
| 12 | Abandoned practice sessions swept after 2 h of no activity: stored status `abandoned`, shown as "ditinggalkan", no reward, checked answers kept and counted; an abandoned Kuiz writes rows for its checked questions without reward | FR-MUR-13-35 | DM-66, API-PRAC-03 |
| 13 | `POST /api/practice/sessions` is idempotent by `clientUuid`; the response adds `answered:[{questionId, selectedOptionId, isCorrect}]` so a reload resumes at the first unanswered question | FR-MUR-16-16, AC-MUR-16-11 | API-PRAC-01 |
| 14 | Practice level codes T1-T5 all offered (`OFFERED_LEVEL_CODES`; `rules.ts:40-45`) | FR-MUR-16-13, AC-MUR-16-9 | API-PRAC-01, API-PRAC-04 |
| 15 | Bijak autosave: 800 ms debounce, per-part `rev`, server ignores a change whose `rev` is not above the stored one, `savedAt` capped at server now, late sync accepted for 24 h | FR-MUR-13-10, FR-MUR-13-32, AC-MUR-13-28 | DM-68, API-BIJAK-04 |
| 16 | Mod Latihan reward only for parts never opened with "Semak" (needs a per-part `revealed` marker) | FR-MUR-13-14, AC-MUR-13-31 | DM-68, API-BIJAK-04 |
| 17 | Bijak result coins/points = rate x score Syiling and 10 x score XP (rate = admin setting; the "score * 2" comment and constant are wrong); `percent` may stay at one decimal, display is a whole number | FR-MUR-13-14, AC-MUR-13-7 | DM-48, API-BIJAK-04 |
| 18 | Pupil Jana Kertas: `POST /api/bijak/papers/generate` (pupil) answers 404; tab hidden | FR-MUR-13-20, AC-MUR-13-26 | API-BIJAK-03 (pupil: 404) |
| 19 | SPM hub read returns the Kertas Subjektif count ("{n} kertas") for every T1-T5 pupil | FR-MUR-13-1, FR-MUR-13-34, AC-MUR-13-29 | API-BIJAK-07 |
| 20 | Question report: duplicate 409 text `Anda sudah melaporkan soalan ini.`; the server fills `source`; `mine` counts five statuses with `removed` counted under `fixed` for the tile | FR-MUR-54-9, FR-MUR-54-10, AC-MUR-54-7 | DM-82, API-Q-19, API-Q-20 |
| 21 | Support: BM ticket messages; one admin reply per ticket (status machine); `GET /api/config/support` seeded (no 404) | FR-MUR-A4-6, FR-MUR-A4-7, AC-MUR-A3-6 | API-SUP-01, API-SUP-04, API-SUP-05, DM-32, DM-33 |
| 22 | `GET /api/hadiah-digital/items` reads the shared `rewards` catalogue | FR-MUR-38-5, AC-MUR-38-4 | API-GAME-08, DM-77 |
| 23 | Referral reward 100 Syiling from the admin setting; constants 50/25 removed | FR-MUR-36-6, AC-MUR-36-5 | DM-38, DM-48, API-MUR-10 |
| 24 | Headcount read allowed for role student (own classes, own rows only) | FR-MUR-3-1, FR-MUR-3-10 | API-RPT-08 |
| 25 | `GET /api/prestasi` for role student returns own data and issues no redirect; school/class endpoints 403 for student | FR-MUR-4-2, FR-MUR-4-13, AC-MUR-4-9 | API-RPT-01 |
| 26 | Profile reads: last 30 days calendar, badges, last 10 sessions; public profile endpoint (first name only, `school: null`) | FR-MUR-A1-1, FR-MUR-A1-5, AC-MUR-A1-7 | API-MUR-02, API-MUR-03 |
| 27 | Join-class endpoint `POST /kelas-saya/join` removed; class `join_code` not shown | FR-MUR-8-3, AC-MUR-8-3 | API-MUR-04 (the route answers 404; the column stays; D113-continued 3) |
| 28 | Rank and percentile reads for Kedudukan (kelas, sekolah, negeri, kebangsaan) | FR-MUR-18-2, AC-MUR-18-5 | API-RPT-13 |
| 29 | Liga enrolment by Admin Pusat only; no Guru/Admin Sekolah endpoint | FR-MUR-23-5, AC-MUR-23-4 | API-ADM-25, API-GAME-05 |
| 30 | Game coins setting `games_award_syiling` default off, caps, robot label "Robot PrestasiPlus" after 30 s, `battle` rows | FR-MUR-21-8, FR-MUR-21-9, AC-MUR-21-7 | DM-38, DM-48, DM-60, DM-44 |
| 31 | Dashboard: mood check-in built (D114(b), reverses D113): table `mood_checkins` and `POST /api/me/mood` | FR-MUR-2-12, AC-MUR-2-8..2-12 | DM-84, API-MUR-11 (OD-11 superseded) |
| 32 | Schools search `GET /api/schools/search?state=&q=` (min 2 characters, 20 results) | FR-MUR-AUTH-1 | API-ADM-04 |
| 33 | Timeline: post text max 500 and type enum; Marketplace: category/condition/sort filters and order (quantity, note) | FR-MUR-39-6, FR-MUR-32-6, AC-MUR-39-5, AC-MUR-32-5 | API-RPT-14, API-ADM-19 |
| 34 | Tournament, PKSK start sets (A/B/C = 10, domain = 5) and Cabutan purchase idempotency | FR-MUR-19-7, FR-MUR-22-6, AC-MUR-22-5 | API-PRAC-12, API-GAME-12, DM-78 |

---

## 5. Summary table

Counts are unique IDs written in this document (`FR-MUR-...` and `AC-MUR-...`). The 18 responsive-row ACs `AC-MUR-RS-1..18` of 4.9 are counted once, in the "Cross-cutting responsive" row, not in the module rows. A module row counts the FRs and ACs numbered inside its own section.

| Module ID | Name | Priority | Delivery | Current status (GH / UAT) | FRs | ACs |
|---|---|---|---|---|---|---|
| R1-MUR-A1 | Profil Saya | P1 | 1.0 | Partial / Partial | 11 | 10 |
| R1-MUR-A2 | Tetapan Peribadi | P1 | 1.0 | Partial / Partial | 9 | 9 |
| R1-MUR-A3 | Panduan | P2 | 1.0 | OK / OK, config API 404 | 6 | 6 |
| R1-MUR-A5 | Log Keluar | P0 | 1.0 | OK / OK | 4 | 5 |
| R1-MUR-2 | Dashboard | P1 | 1.0 | Partial / Partial | 13 | 9 |
| R1-MUR-3 | Headcount | P0 | 1.0 | Missing (403) / Missing | 11 | 9 |
| R1-MUR-4 | Prestasi | P0 | 1.0 | Wrong (school data) / Wrong | 14 | 9 |
| R1-MUR-5 | Analitik Adaptif | P1 | 1.0 | OK / OK, SP data empty | 8 | 6 |
| R1-MUR-6 | Analisa Item | P0 | 1.0 | Missing / Missing | 11 | 8 |
| R1-MUR-7 | Video | P2 | 1.0 | OK / OK | 7 | 5 |
| R1-MUR-8 | Kelas Saya | P1 | 1.0 | OK / OK | 7 | 5 |
| R1-MUR-9 | Soalan by Chapter | P0 | 1.0 | Empty / Empty ("Tiada subjek bab"), T1 gate | 14 | 12 |
| R1-MUR-12 | Remedial | P1 | 1.0 | Partial / Partial | 8 | 6 |
| R1-MUR-13 | SPM (Bijak, Databank, Tracking A, Subjektif, Kertas Subjektif) | P0 | 1.0 | Partial / No Bijak papers; 375 px gaps | 36 | 32 |
| R1-MUR-14 | Heatmap Topik Lemah | P1 | 1.0 | OK / Empty | 8 | 5 |
| R1-MUR-16 | Latih Tubi | P0 | 1.0 | OK / OK (T5), T1 gate; figure-less items served | 16 | 11 |
| R1-MUR-21 | Permainan | P1 | 1.0 | OK / OK | 9 | 7 |
| R1-MUR-54 | Laporan Soalan | P0 | 1.0 | Hidden / Hidden | 10 | 7 |
| **Subtotal 1.0 columns (18 modules)** | | | | | **202** | **161** |
| R1-MUR-A4 | Tiket Bantuan | P2 | After 1.0 | OK / OK, reply missing | 7 | 7 |
| R1-MUR-17 | Soalan Berstruktur | P1 | 1.0 (linked from 13) | Seed only / seed only | 7 | 5 |
| R1-MUR-18 | Kedudukan | P1 | 1.0 (linked from 33) | Empty list / same | 7 | 5 |
| R1-MUR-19 | PKSK | P1 | After 1.0 | Listing / listing | 8 | 5 |
| R1-MUR-20 | Artikel | P1 | 1.0 (linked from 2) | OK / OK | 6 | 4 |
| R1-MUR-22 | Cabutan Bertuah | P1 | After 1.0 | Demo draw / demo | 6 | 5 |
| R1-MUR-23 | Tournament | P2 | 1.0 (linked from shell banner) | Empty / empty | 5 | 4 |
| R1-MUR-24 | Topik | P1 | After 1.0 | OK / T1 gate + empty | 6 | 5 |
| R1-MUR-25 | Peta Belajar | P1 | After 1.0 | OK / T1 gate + 0/0 | 6 | 5 |
| R1-MUR-26 | Set Soalan Guru | P1 | 1.0 (linked from 2, 8) | Empty / empty | 6 | 6 |
| R1-MUR-27 | Audio KBAT | P2 | After 1.0 | Empty / empty | 5 | 4 |
| R1-MUR-28 | Syiling & Token | P1 | 1.0 (linked from header, 2) | Partial / partial | 6 | 5 |
| R1-MUR-29 | Tukar Token | P1 | 1.0 (linked from 28, 31) | OK / OK | 5 | 4 |
| R1-MUR-30 | Cabaran Harian | P1 | 1.0 (linked from 2, 28) | OK / OK | 6 | 5 |
| R1-MUR-31 | Kedai Hadiah | P1 | 1.0 (linked from 28) | Empty catalogue / empty | 6 | 5 |
| R1-MUR-32 | Marketplace | P2 | After 1.0 | Sample data / sample | 6 | 5 |
| R1-MUR-33 | Papan Pendahulu | P1 | 1.0 (linked from 8, 18) | No filters / same | 6 | 5 |
| R1-MUR-34 | Pencapaian | P2 | After 1.0 | OK / OK | 5 | 4 |
| R1-MUR-35 | Kotak Misteri | P2 | After 1.0 | Model differs / same | 6 | 5 |
| R1-MUR-36 | Rujuk Kawan | P2 | After 1.0 | Rule differs / same | 6 | 5 |
| R1-MUR-38 | Kedai Hadiah DIGITAL | P2 | After 1.0 | Empty catalogue / empty | 5 | 4 |
| R1-MUR-39 | Timeline Saya | P2 | After 1.0 | Manual model / same | 6 | 5 |
| R1-MUR-40 | Jemput Ibu Bapa | P2 | After 1.0 | OK / OK | 6 | 5 |
| **Subtotal rest of the matrix (23 modules)** | | | | | **138** | **112** |
| R1-MUR-AUTH | Shared sign-in screens (3C: login, register, reset) | P0 | 1.0 | Built in code, first written spec | 4 | 4 |
| Common | Common rules for the rest of the matrix (P2) | P1 | | | 5 | 3 |
| Shell | Shared shell (SH) | P0 | | Partial | 12 | 6 |
| Cross-cutting | Question-paper contract (QP, 4.8) | P0 | | Gaps seen live | 17 | 17 |
| Cross-cutting | DSKP level per module (DK, 4.10) | P1 | | UAT 0 mapping | 5 | 4 |
| Cross-cutting responsive | Responsive rows of 4.9 (AC-MUR-RS-1..18) | P0 | | | 0 | 18 |
| **Total (41 modules + sign-in block, common, shell, cross-cutting)** | | | | | **383** | **325** |

Arithmetic: FR 202 + 138 + 4 + 5 + 12 + 17 + 5 = 383; AC 161 + 112 + 4 + 3 + 6 + 17 + 4 + 18 = 325.

P0 modules (1.0 columns): R1-MUR-A5, 3, 4, 6, 9, 13, 16, 54, plus the QP contract that 9, 13 and 16 depend on. Row 15 and row 37 stay hidden (D102) and have no section.

---

## 6. Decisions (every former open question is decided) and evidence closure

Every question that was open in earlier drafts is decided here by the product-owner decisions D100-D113 and the register decisions K1-K22 (section 6.2). No question is left for a developer or an agent to ask.

### 6.1 Decided questions

| ID | Question | Decided | Decision ID |
|---|---|---|---|
| OQ-MUR-1 | T1-T3 pupils and the "akan datang" gate | T1-T5 are served wherever questions exist; the UI gate is removed and the API gate at `rules.ts:43-45` is removed (FR-MUR-16-13). Content volume per subject is loaded by the Admin users (first the six sample-paper subjects) and is not a build dependency. | D101, D112(4), D113 |
| OQ-MUR-2 | Dashboard "Pakej SPM Aktif" or "Percubaan Percuma" | V2 first: the package card when the pupil has an active package; otherwise the trial card when a free-trial quota exists for the pupil; otherwise nothing (FR-MUR-2-4). | D113 |
| OQ-MUR-3 | Mascot, "Tukar Rakan Belajar", banner carousel | "Tukar Rakan Belajar" and the mascot chooser stay hidden in R1; the light/dark toggle stays. Banner carousel and mascot: not in the V2 dashboard, visual only, KEPT as in V3 (existing V3 UI stays, D114(d), D115); only their data must be real. | D77, D113, D114, D115 |
| OQ-MUR-4 | Place of "Laporan Soalan" | Under the V2 heading "Killer Features" (2.1). | D113 |
| OQ-MUR-5 | Hidden module page | Standard 404 page (FR-MUR-SH-9). | D108(6) |
| OQ-MUR-6 | Who loads Bab; Heatmap fallback | Admin users load Bab (a Bab is required before Terbit when the subject and Tingkatan have chapters; bulk "Tetapkan Bab" is in the admin PRD 30); Heatmap uses Bab first and DSKP SP only where the subject has no Bab-linked question (FR-MUR-14-3). | D89, D112(1), D112(4) |
| OQ-MUR-7 | Pupil Jana Kertas | Out of R1: tab hidden, route 404 (FR-MUR-13-20, AC-MUR-13-26). | D112(6) |
| OQ-MUR-8 | Level formula | floor(XP / 1000) + 1 everywhere. | D113 (FD-MUR-5) |
| OQ-MUR-9 | Where a pupil changes e-mail, phone, school | A pupil cannot; the help text of FR-MUR-A2-5 points to the teacher or school admin. | D113 |
| OQ-MUR-10 | Mood check-in | **Superseded by D114(b): built in R1** (FR-MUR-2-12; DM-84, API-MUR-11). The earlier D113 drop is reversed. | D114, D115 |
| OQ-MUR-11 | "Tambah Video" for pupils | Not rendered for a pupil (FR-MUR-7-5). | D113 |
| OQ-MUR-12 | English Headcount status words | Kept as V2 ("Active", "Draft", "On Track", "Below Target"). | D113 |
| OQ-MUR-13 | Answer modes | Eleven served item kinds, i.e. 9 leaf modes plus the 2 `mcq` views (4.6 item 3): `mcq` 2-8, `true_false`, `mcq_multi`, `match_letter`, `short_text`, `numeric`, `working`, `essay`, `essay_choice`, `drawing`, `table_fill`; K17 withdrawn. | D113, K12 |
| OQ-MUR-14 | Figures and groups in drills | Drills serve figure questions and whole stimulus groups. | D105 |
| OQ-MUR-15 | Daily report cap | 20 per day (ERR-QUOTA-02). | D113 |
| OQ-MUR-16 | V2 "belum tersedia" wording for data-empty states | The exact V2 sentences stay only where they say missing data or access, never a missing feature. | D100, D113 |
| OQ-MUR-17 | Tournament empty copy | `Tiada liga atau tournament buat masa ini.` | D113 |
| OQ-MUR-18 | Marketplace payment | Orders are recorded, prices in Ringgit, no online payment (FR-MUR-32-4). | V2 page, D113 |
| OQ-MUR-19 | Kotak Misteri and Rujuk Kawan rules | One 50-Syiling box with the V2 odds; 100 Syiling per referred friend, both admin settings (FR-MUR-35-1, FR-MUR-36-2). | K18, D113 |
| OQ-X-3 | Join a class by code | No pupil join (FR-MUR-8-3). | D-A8 |

### 6.2 Register decisions K1-K22 and where each is applied

| K | Applied in |
|---|---|
| K1 password minimum 8 | 0A.9, FR-MUR-A2-3, FR-MUR-A2-8, R1-MUR-AUTH |
| K2 Bio 1000 | FR-MUR-A1-11 |
| K3 aspiration column | FR-MUR-A1-10 |
| K4 partial `PUT /api/me` | FR-MUR-A1-9 |
| K5 server ignores grade, school, role | FR-MUR-A2-6, AC-MUR-A2-5 |
| K6 Tingkatan mapping `grade = n + 6` | OPT-TINGKATAN (A1), R1-MUR-AUTH |
| K7 BM messages only | FR-MUR-A2-7, FR-MUR-AUTH-1 |
| K8 leaderboard default `all` | FR-MUR-33-6 |
| K9 whole-number percent | 0A.4, R1-MUR-13 behaviour (7) |
| K10 "Sekitar anda" five rows | R1-MUR-18 |
| K11 OTR fraction floor(100k/n)/100 (settled) | R1-MUR-3, AC-MUR-3-2 |
| K12 `mcq` 2-8, `true_false`, `mcq_multi` | 4.6 item 3 |
| K13 report failure copy | FR-MUR-54-7 |
| K14 two vocabularies | OPT-ARAS-KBAT, FR-MUR-17-7 |
| K15 ticket fields | R1-MUR-A4 |
| K16 Bijak result coins use the rate | FR-MUR-13-14, A2 item 17 |
| K17 `essay_choice` not served | withdrawn: served (D113, 46 D-PA-5) |
| K18 referral 100 | R1-MUR-36 |
| K19 `pending_parent_consent` label | OPT-STATUS-REDEEM |
| K20 accepted parts self-markable | A2 item 10 |
| K21 "Semua Kesukaran" | FR-MUR-16-14 |
| K22 tier thresholds are admin config | R1-MUR-28 |

Register section 7 rows for this file: row 15 (R1-MUR-33 route), row 16 (R1-MUR-33 gap), row 17 (R1-MUR-38 gap) and row 18 (hidden modules list, `/spm-mock` redirects) are applied.

### 6.3 Evidence closure

Evidence that cannot be captured from V2 (flags off, no sample account) is replaced by a decision written in the module block, and is proven on UAT by the module's ACs. Every item below is closed.

| Item | Closure |
|---|---|
| E-1 Headcount with a class | Behaviour is fixed by HC-SPEC (HC-1 to HC-6) and AC-MUR-3-1 to AC-MUR-3-9. |
| E-2 populated Analisa Item and Prestasi | Fixed by FR-MUR-6-* and FR-MUR-4-* and the category rules of the module blocks. |
| E-3, E-3b Video | Empty state quoted; populated layout fixed by the field block of R1-MUR-7; "Tambah Video" hidden (OQ-MUR-11). |
| E-4, E-11 Panduan, gamification values | Quoted in the modules. |
| E-5 report dialog | Dialog fixed by the field block of R1-MUR-54 (V1 M05 S7 copy plus K13). |
| E-6, E-6b, E-10, E-10b, E-17 Bijak, Subjektif, Berstruktur Semakan and self-mark | Fixed by 46 sections 3 and 3.4 and R1-MUR-13 / R1-MUR-17 field blocks. |
| E-7, E-12, E-14 games hub, PKSK, Cabutan, Tournament | Fixed by 48 (GAME-00 to GAME-25) and the module blocks. |
| E-8 UAT T1-T3 data | Admin content work (D112(4)); the gate is removed regardless of volume. |
| E-9 level formula | floor(XP / 1000) + 1 (OQ-MUR-8). |
| E-13, E-13b, E-18, E-11b, E-11c Kelas Saya, Set Soalan Guru, Audio KBAT, Jemput Ibu Bapa, Kedai Hadiah DIGITAL, Tebusan Saya, Marketplace | Fixed by the field blocks of the modules; `/cikgu/hadiah` reads the shared catalogue (D113). |
| E-15 populated Heatmap | Fixed by R1-MUR-14 field block (tile text and colour bands). |
| E-16 Latih Tubi screens | Fixed by the R1-MUR-16 field block and 46 section 4.8. |
