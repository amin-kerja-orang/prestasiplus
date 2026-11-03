# PRD 47: V3 duplicates register (what is duplicated, which copy is kept, what happens to the rest)

| | |
|---|---|
| Purpose | The decided list of every place where V3 has two or more copies of one function (menus, screens, routes, tables, content, code, APIs): which copy is the single source of truth, what happens to the others, and what must be true when it is done. It is the reference behind the CI rules that stop a third copy from being built. |
| Audience | Developers and cloud agents on every plan card (read the entry named in your card), the Delivery Lead, QA. |
| Status | Final. All 34 entries are decided by D113 (Delivery Lead, by principle); none is open. Dated 2026-11-04. Branch `docs/r1-prd-devplan`. Code reference commit `cadc7a674`. Language: English; UI copy is exact BM. |
| Related | [00-index](00-index.md), [30-admin-pusat](30-admin-pusat.md) (admin menu, section 3.3), [40-cross-cutting](40-cross-cutting.md) (glossary X8 "six meanings of duplicate", FR-X1-5, FR-X4-5), [45-question-authoring-flow](45-question-authoring-flow.md), [50-data-model-erd](50-data-model-erd.md), [60-api-contract](60-api-contract.md), `docs/plan/r1-development-plan.md`, [`docs/plan/r1-canonical-map.json`](../../plan/r1-canonical-map.json), [`docs/plan/R1-START-HERE.md`](../../plan/R1-START-HERE.md) |

**Audit basis.** This register was written on 2026-11-04 as a read-only audit of the code at the reference commit. A claim marked "verified" was checked in the code; a claim marked "doc says" comes from the R1 PRD or plan and was not contradicted by the code unless stated.

**The decisions in one list (D113).** Set Builder is the only paper builder. Studio is the only question editor (Quick Edit stays as the edit target of the SPM lanes). `/leaderboard` and `GET /api/leaderboard` are canonical. Bijak is the only exam engine; `/spm-mock` redirects to `/spm/bijak`. There is one reward catalogue, `rewards` and `reward_redemptions`. `src/shells/pentadbiran/menu.ts` is the only admin menu. `previewHubRoutes` is deleted by S0-T05. `practice_answers` with `mode` is the only answer store. A stimulus group (1..n questions) is the only way to attach a shared figure or passage.

---

## Read this first

1. **What "duplication" means here.** V3 was built by several sessions in parallel. Each session built its own version of the same thing. So V3 now has two or three screens, URLs, tables or code paths for one function.
2. **Why it hurts.** The admin sees three lists called "Bank Soalan". Two review queues show different counts (3 vs 0). A pupil can open two different "Papan Pendahulu" pages. Reports add up answers from different tables and show different numbers.
3. **The rule.** One function = one screen, one route, one table. Keep the copy that matches V2 (label and flow). If V2 does not decide, keep the most complete implementation. Merge the rest into it.
4. **Never lose a function.** Before you remove or redirect a copy, list what it could do. Each of those things must exist in the kept copy (the "No function lost" line in each entry).
5. **Never delete first.** Order of work: build or confirm the function in the kept copy, then redirect or hide the other copy, then migrate data, and only then (in a later release) drop the old table or code.
6. **Redirect, do not break.** A route that another screen, a bookmark or a V2 habit may use is never removed without a redirect (HTTP-level alias in the router).
7. **Do not invent decisions.** Everything here is decided, either by an earlier D-decision (D90-D110) or by **D113** (Delivery Lead, by principle: keep the V2-matching or most complete copy, merge the rest, never lose a function). A case that is not covered is decided by the same rule and recorded in the pull request as a D113-continued decision; nobody waits for an answer.
8. **How to use this register.** Find your task card (for example S2-T03) in the summary table, open the entry, read "Keep", "Action", "No function lost" and "Do NOT". Then read the Proof line: that is what must be true when you are done.
9. **Section 6** lists things that look like duplicates but are on purpose (do not merge them). **Section 7** lists the applied document fixes. **Section 8** lists the decisions taken by D113. **Section 9** is the glossary of internal codes. **Section 10** describes the CI rules and the canonical map that enforce this register.
10. **Improve, not rebuild (FR-X1-5).** Replacing a working screen, component or API needs the Delivery Lead's written approval. Merging a duplicate means moving the missing functions into the kept copy, not rewriting the kept copy.

Counts: 11 menu/screen duplicates, 5 route/page groups, 7 data-structure duplicates, 4 data-content duplicates, 7 code/API duplicates = 34 entries. No item is open: every formerly open point is now **DECIDED (D113)** (section 8). Section 7 records the document fixes that were applied.

---

## Summary table

Keep column: the single source of truth. Action words: MERGE (move functions into the kept copy), REDIRECT (route stays, forwards), REMOVE FROM MENU (screen stays reachable from a button/tab), HIDE (reachable by direct URL only), MIGRATE (data moves, then old retired), SWITCH READER (code reads the kept table).

| # | Kind | Plain description | Keep | Action | Card |
|---|---|---|---|---|---|
| M-01 | Menu/screen | Three menu items are all called "Bank Soalan..." and open three different lists of the same questions | `Bank Soalan (Studio)` `/admin/studio`; `Senarai Soalan` `/admin/questions` as legacy sub-item | RENAME BS-01, HIDE KS-02, list redirects to Databank lane | S0-T07, S2-T03 |
| M-02 | Menu/screen | "Import & Semakan" and "Senarai Ekstrak" are two menu items for one screen | `Import & Semakan` | REMOVE FROM MENU KS-14 | S0-T07, S2-T02 |
| M-03 | Menu/screen | Actions (upload, write manually, CSV import, contract) are listed as menu destinations | Buttons inside Import & Semakan, Studio, Set Builder | HIDE menu entries, keep routes | S0-T07, S2-T05 |
| M-04 | Menu/screen | Two review queues for pending questions show different counts | Studio status filter `Menunggu Semakan` | REDIRECT list only; review workspace stays (DECIDED D113) | S2-T03 |
| M-05 | Menu/screen | Two paper builders ("Pembina Kertas" and "Set Builder") list and edit the same papers | `Set Builder` `/admin/studio/sets` | REDIRECT list and `baharu`; `/:id` becomes `Semak Kertas`; PaperEditorPage retired after function move (DECIDED D113) | S3-T02, S2-T03 |
| M-06 | Menu/screen | Three editors for one question (old flat form, Studio wizard, Quick Edit) | Studio wizard; Quick Edit for the SPM lane | Old form redirects to Studio after field comparison (DECIDED D113) | S2-T01, S2-T05 |
| M-07 | Menu/screen | "Kualiti Soalan", "Laporan Soalan", "Kiriman Guru" and "Soalan Berstruktur" are separate menu items for what V2 shows as tabs/lists | Tabs of `Senarai Soalan` / `Import & Semakan` | MERGE as tabs, routes stay | S0-T07, S2-T06 |
| M-08 | Menu/screen | Hidden SPM placeholders duplicate hub lane cards or functions that now live in Tracking A | Hub lane cards + group `SPM` items | MERGE (KS-03..06); REMOVE (KS-10..12) | S0-T07, S3-T03 |
| M-09 | Menu/screen | Admin menu item "Monitoring" opens the teacher route | `/admin/monitoring` (same components) | RE-POINT | S0-T07, S6-T08 |
| M-10 | Menu/screen | "SPM Mock Exam" is listed twice in the pupil menu and is a second mock-exam product next to Bijak SPM | Hidden in R1; Bijak SPM is the R1 product | REDIRECT `/spm-mock` to `/spm/bijak`; retire the table (DECIDED D113) | S0-T05, S3-T04 |
| M-11 | Menu/screen | Admin Pusat items also exist in the old user/admin nav files | `src/shells/pentadbiran/menu.ts` | REMOVE admin items from the old nav files (DECIDED D113) | S0-T07 |
| R-01 | Route/page | "Papan Pendahulu" has two URLs, two pages and two APIs | `/leaderboard` (dashboard link) | `/gamification/leaderboard` redirects to it; one API (DECIDED D113) | S7-T06 |
| R-02 | Route/page | "Kedai Hadiah" and "Kedai Hadiah Digital" are two pages and two catalogue endpoints, one is always empty | One catalogue (`rewards`), two entry points | POINT `/cikgu/hadiah` at the shared catalogue | S7-T05 |
| R-03 | Route/page | "Laporan Mingguan" sidebar item opens a 403 page while the real teacher page is another route | `/guru/laporan-mingguan-kelas` for teachers | RE-POINT sidebar | S0-T06, S6-T01 |
| R-04 | Route/page | V2 URLs and V3 URLs both exist for the same admin pages (Studio edit `/sunting` vs `/edit`, imports, kertas-subjektif) | V3 built route is canonical (D107); V2 path is alias | ADD redirects | S2-T03 |
| R-05 | Route/page | Same page reachable by two URLs on purpose (Panduan, Set Soalan create, Misi Harian create) | Both, one component | KEEP (not a defect) | n/a |
| S-01 | Data structure | Four parallel curriculum structures | `chapters/topics/subtopics` (pupil Bab) + `curriculum_nodes` (DSKP tags) | SWITCH READER away from `legacy_topics`; keep `dskp_*` as teacher list | S5-T12, S4-T06 |
| S-02 | Data structure | Pupil answers are written to about nine tables | `practice_answers` with `mode` | MIGRATE / one port; modes `structured`, `battle`, `pksk`, `audio_kbat` added (DECIDED D113) | S5-T15 |
| S-03 | Data structure | Papers, teacher sets, Tracking A sets, mock exams and import batches are separate "paper-like" tables | `papers` (admin) + `question_sets` (teacher) | KEEP by purpose; mock exams retired (DECIDED D113) | S3-T02, S3-T06, S6-T20 |
| S-04 | Data structure | A stimulus can be attached three ways (question, part, group) plus an intake copy | Stimulus group (1..n questions) for all new entry | RULE (no schema) | S1-T01 |
| S-05 | Data structure | Two reward catalogues (`rewards` and `syiling_rewards`) | `rewards` + `reward_redemptions` | Switch Kawalan Reward to it; migrate and retire `syiling_rewards` (DECIDED D113) | S7-T05 |
| S-06 | Data structure | Two sources for the coin rate (code constant 3 vs setting 1) | `reward_settings` row | MIGRATE to setting, remove constant | S7-T05 |
| S-07 | Data structure | One column (`difficulty_tp`) stores two different concepts (TP and difficulty) | Two columns | ADD `difficulty_level` | S1-T02 |
| C-01 | Data content | A figure stored as its own "question" and the questions that cite it left without it | Stimulus group | REGROUP then archive the figure row | S1-T07, S2-T04, S4-T04 |
| C-02 | Data content | Stem text repeated in the stem and in its only part prompt | One copy | RENDER once now; CLEAN the data | S1-T07, S4-T04 |
| C-03 | Data content | A shared figure copied for every question that cites it | One `stimulus`, one group | NEW imports store once; EXISTING copies: read-only report (U-OP-18), then admin merge (DECIDED D113) | S1-T03, S2-T04 |
| C-04 | Data content | Rows that can be inserted twice (same question in sibling sets, two draft papers for a batch, repeated answers) | Unique constraints | ADD constraints | S3-T05, S1-T10, S5-T15 |
| P-01 | Code/API | Whole app has a mock path and a real path | Real API only | DELETE mock paths module by module | S0-T09 |
| P-02 | Code/API | Two leaderboard endpoints and an always-empty digital-gift endpoint | `GET /api/leaderboard` (fixed for period/scope); shop catalogue | Remove `GET /api/gamification/leaderboard` once unused (DECIDED D113) | S7-T06, S7-T05 |
| P-03 | Code/API | Two front-end clients call the same admin endpoints (`/api/questions`, `/api/admin/papers`) | Client in the owning module; the other becomes a re-export, then is deleted (DECIDED D113) | S2-T03, S3-T02 |
| P-04 | Code/API | The same number is computed several ways (pupils 17/16/13) | One named query per measure | MERGE (XS-1..XS-5) | S6-T03 |
| P-05 | Code/API | Three "On Track" rules for Headcount | One rule (XS-6) | MERGE | S10-T02 |
| P-06 | Code/API | `GET /api/weekly-report` always 403 next to a missing teacher report endpoint | `GET /api/guru/weekly-report` (to build) | BUILD new, leave old | S6-T01 |
| P-07 | Code/API | Two mock-exam engines: `/api/spm-mocks` and `/api/bijak/attempts` | Bijak (single engine) | No new writes to `spm_mock_exams`; retire (DECIDED D113) | S3-T04 |

---

## 1. Menu items and screens

### M-01 Three "Bank Soalan" lists
- **Plain description:** Three different menu items are all called "Bank Soalan" in some form. They open three different lists of the same questions (same store, `GET /api/questions`).
- **Where (verified):**
  - `Bank Soalan` (BS-01) `/admin/questions`, `src/shells/pentadbiran/menu.ts:95`, page `m04-question-bank/pages/QuestionListPage.vue`.
  - `Bank Soalan (Studio)` (BS-08) `/admin/studio`, `menu.ts:103`, `StudioListPage.vue`.
  - `Bank Soalan SPM` (KS-02) `/admin/spm/soalan`, `menu.ts:116`, `m28-bijak-spm/admin/papers/BankPage.vue` (route `m28-bijak-spm/routes/admin-papers.ts:40`; edit page `/admin/spm/soalan/:qid/sunting` at `:50`).
  - The menu group itself is also named `Bank Soalan` (`menu.ts:90-92`).
  - The lane page `Databank Soalan` `/admin/spm/databank` (`routes/admin-kandungan.ts:19`) is a fourth list of questions, but V2 has it (hub lane), so it is kept.
- **Keep (decided, D107, 30 section 3.3):** `Bank Soalan (Studio)` is the V2 canonical bank. `Senarai Soalan` (BS-01 renamed, V2 label) stays as a sub-item of the new sub-group `Bank Lama (Legasi)`, because V2 has both (V2 banner: "Ini bank soalan lama (model flat). Soalan baharu dicipta dan diterbitkan di bank kanonikal."). The two are one store, two list styles (assumption A1).
- **Action for the other copies:**
  - BS-01: MERGE (rename) to `Senarai Soalan`, route `/admin/questions` unchanged (tabs `Kualiti`, `Laporan` inside, see M-07).
  - KS-02 `Bank Soalan SPM`: HIDE. The list route `/admin/spm/soalan` REDIRECTS to `/admin/spm/databank`. The route `/admin/spm/soalan/:qid/sunting` stays as Quick Edit (see M-06). Existing bookmarks to `/admin/spm/soalan` land on the Databank lane list.
  - No data changes.
- **No function lost (check this carefully):** the hidden `BankPage.vue` does these things: KPI strip by subject and status, filters, a preview dialog, and "Sunting" on a published question creating version n+1 that waits in the review queue while the live version keeps serving. The target lane page `LaneDatabankPage.vue` has only: columns Senarai/Tajuk/Perhatian/Tindakan, status filter, row action "Sunting"; it says "Pratonton is not a separate screen in R1 (the Bank page previews in a dialog)". Once the Bank page is hidden this sentence is false. So the KPI strip and the preview dialog have no stated new home. Gap in the docs, closed by D113 (section 7, row 4). **DECIDED (D113):** the Bank page KPI strip (by subject and status) moves into the Studio list header. The preview dialog becomes the row action `Pratonton` in the Studio list (the Databank lane `/admin/spm/databank` uses the same action; the V2 preview page `/admin/studio/questions/:id/preview` of PRD Q-04 is the target of that action and is not yet in `routes/studio.ts`). "Sunting on a published question creates version n+1" is kept in Studio `Sunting`. Only after these three exist does `/admin/spm/soalan` redirect.
- **Cards / PRD:** S0-T07 (menu), S2-T03 (redirects). PRD 30 section 1.1 row 1; section 3.3 rows BS-01, BS-08, KS-02; 4.V rows Q-03, Q-20; 01 problem table; D107; 02-urs URS-ADM-32.
- **Proof:** S0-T07 test "menu snapshot: no duplicate 'Bank Soalan'; 8 items in Soalan"; S2-T03 test "route table: every alias resolves, no 404"; AC-ADM-H0.1. Acceptance to add: Given the Admin Pusat menu, then exactly one item contains the words "Bank Soalan" in its label and `/admin/spm/soalan` lands on `/admin/spm/databank`.
- **Do NOT:** do not build a fourth list. Do not delete `BankPage.vue`/`BankEditPage.vue` before the KPI strip, preview and version-n+1 edit are confirmed elsewhere. Do not rename `/admin/questions` (the Studio banner and V2 link to it). Do not give `Senarai Soalan` its own data layer: it reads the same `GET /api/questions`.

### M-02 "Import & Semakan" and "Senarai Ekstrak": one screen, two menu items
- **Plain description:** Two menu items open the same URL and the same screen.
- **Where (verified):** `BS-02 Import & Semakan` `menu.ts:96` and `KS-14 Senarai Ekstrak` `menu.ts:114`, both `/admin/spm/soalan/ekstrak`; page `m28-bijak-spm/admin/intake/pages/IntakeListPage.vue` (`routes/admin-intake.ts:20`); batch review `/admin/spm/soalan/ekstrak/:batchId` (`:50`).
- **Keep (decided):** `Import & Semakan` (V2 `/admin/studio/imports`), canonical route `/admin/spm/soalan/ekstrak`, with three tabs `Kelompok Item`, `Kertas Diimport`, `Kiriman Guru`.
- **Action:** KS-14: MERGE (REMOVE FROM MENU), it becomes the tab `Kelompok Item`. The V2 path `/admin/studio/imports` is added as an alias redirect (see R-04). Existing links to `/admin/spm/soalan/ekstrak` keep working (same URL).
- **No function lost:** Senarai Ekstrak has no function of its own (same component). Tab `Kertas Diimport` and `Kiriman Guru` are new in the kept screen (S2-T02).
- **Cards / PRD:** S0-T07, S2-T02, S2-T03. PRD 30 section 1.1 row 2; 3.3 rows BS-02, KS-14; 4.V row Q-07; FR-ADM-Q07.*.
- **Proof:** AC-ADM-Q07.1 (batch ends "Selesai" or "Gagal", never stuck) and AC-ADM-Q07.3 (batch to draft paper listed in `Kertas Diimport`); menu snapshot test of S0-T07.
- **Do NOT:** do not give Senarai Ekstrak a separate route or a copy of the list component. Do not remove the `/ekstrak/:batchId` review route.

### M-03 Actions listed as menu destinations
- **Plain description:** Things you do (upload a paper, write a question by hand, import a CSV, edit a contract) are shown as menu items next to real destinations.
- **Where (verified):** `KS-13 Muat Naik Kertas` `/admin/spm/soalan/muat-naik` (`menu.ts:112`, route `admin-intake.ts:30`); `KS-16 Tulis Soalan Manual` `/admin/spm/soalan/manual` (`menu.ts:113`, `admin-intake.ts:40`); `KS-08 Kontrak Simulasi` `/admin/spm/kontrak` (`menu.ts:122`, `admin-kontrak.ts:19`); `Import CSV` `/admin/questions/import` and `/admin/questions/import-history` (`m04 routes/imports.ts`, no menu id).
- **Keep (decided):** the screens stay as routes; the access moves to buttons: `Muat Naik Kertas` in the Import & Semakan header and `Import PDF` in the Studio header (D83 D-5); `Tulis Soalan Manual` button in Import & Semakan, with Studio `Cipta baharu` as the V2 path; `Import CSV` button in the `Senarai Soalan` header and in Import & Semakan; `Kontrak Simulasi` button on the Set Builder landing and `Sunting kontrak` in Set Builder and Semak Kertas (V2 has no sidebar entry; OQ-04 closed by D107).
- **Action:** HIDE the menu entries (items stay in `PENTADBIRAN_FULL_MENU` data). The direct URLs still work.
- **No function lost:** upload (FR-ADM-Q08), manual batch (Q-10), CSV (Q-11), contract (Q-16) stay as routes and get buttons. Each button must exist before its menu item is removed.
- **Cards / PRD:** S0-T07 (menu), S2-T05 (manual entry, CSV UI), S3-T01 (contract), S2-T03 (header buttons). PRD 30 3.3 rows KS-08, KS-13, KS-16 and the two unnamed Import CSV routes; D83 D-5; D107.
- **Proof:** AC-ADM-Q08.*, AC-ADM-Q10.*, AC-ADM-Q11.*, AC-ADM-Q16.* (open the function from the button); menu snapshot test.
- **Do NOT:** do not remove a menu item before its button is live (the function becomes unreachable). Do not delete the routes.

### M-04 Two review queues
- **Plain description:** The Studio says 3 questions wait for review; "Baris Gilir Semakan" says 0. Two lists of the same waiting questions disagree.
- **Where (verified):** `KS-15 Baris Gilir Semakan` `/admin/spm/semakan` (`menu.ts:115`; `m28/admin/papers/ReviewQueuePage.vue`; routes `admin-papers.ts:20` list and `:30` item `/admin/spm/semakan/:key` -> `ReviewItemPage.vue`) versus the Studio list with status `Menunggu Semakan` (`StudioListPage.vue`, URL filter key `status`). Evidence: E2E F3.
- **Keep (decided):** the Studio status filter `Menunggu Semakan` (status value `review`) for questions; the tab `Kelompok Item` (column `Disemak`) for pending extract items.
- **Action:** `/admin/spm/semakan` REDIRECTS to the Studio list filtered to waiting-review. **Correction:** the PRD writes `?status=reviewed`; the status vocabulary (30 section 0, F-19) says the filter value is `review`, not `reviewed`. Use `?status=review`. Both counts must come from one query ("Menunggu Semakan" and the old queue show the same count: S2-T03).
- **No function lost:** `ReviewItemPage.vue` is a review workspace: question or whole stimulus group with its shared figure once, the mark scheme, the publish gate and three decisions (a decision on a group applies to every member). The docs do not say where this workspace goes. **DECIDED (D113):** `/admin/spm/semakan/:key` (`ReviewItemPage.vue`) stays as a screen. It is opened from the Studio `Menunggu Semakan` tile and the row action `Semak`. Only the queue LIST route `/admin/spm/semakan` redirects to `/admin/studio?status=review`.
- **Cards / PRD:** S2-T03 (redirect, same count), S2-T01. PRD 30 1.1 row 4; 3.3 row KS-15; gap F3.
- **Proof:** no AC id exists; plan test: "same count" in S2-T03. Acceptance to add: Given 3 questions in `review`, then Studio `Menunggu Semakan` and the hub attention text both show 3, and `/admin/spm/semakan` lands on the Studio filter.
- **Do NOT:** do not build a third queue. Do not drop the group-level decision logic of `ReviewItemPage`. Do not use `reviewed` as a filter value.

### M-05 Two paper builders ("Pembina Kertas" and "Set Builder")
- **Plain description:** Two menu items list the same papers (`GET /api/admin/papers`) and two pages can edit a paper.
- **Where (verified):**
  - `KS-09 Pembina Kertas` `/admin/spm/kertas` (`menu.ts:123`; list `PaperListPage.vue`, `admin-papers.ts:61`; new `PaperNewPage.vue` `/admin/spm/kertas/baharu` `:71`; editor `PaperEditorPage.vue` `/admin/spm/kertas/:id` `:81`, 934 lines).
  - `KS-17 Set Builder` `/admin/studio/sets` (`menu.ts:124`; landing `m28/admin/builder/pages/SetBuilderLandingPage.vue`; builder `SetBuilderPage.vue` `/admin/studio/sets/:paper/builder`, `routes/admin-builder.ts:20,30`).
  - Both lists call `GET /api/admin/papers` through two separate front-end clients (see P-03).
- **Keep (decided, D107):** `Set Builder` (V2). The PRD also keeps `/admin/spm/kertas/:id` "as 'Semak Kertas Simulasi'", reached from the lane row `Sunting`, which is the V2 review page (`/spm/simulasi-paper/{id}/review`).
- **Action:** `/admin/spm/kertas` (list) REDIRECTS to `/admin/studio/sets`; menu item KS-09 MERGED. **DECIDED (D113):** Set Builder is the only paper builder. `/admin/spm/kertas/baharu` REDIRECTS to the Set Builder create action. `/admin/spm/kertas/:id` becomes `Semak Kertas` (review and `Terbit`, structure read-only) over the same paper data (`GET /api/admin/papers/:id`). `PaperEditorPage.vue` is retired only after this function-by-function comparison (made from the labels of both files; the developer confirms each point in S3-T02). Functions `PaperEditorPage` has that `SetBuilderPage` does not show, which MUST move into Set Builder first: (1) per-section running budget `Markah x / markBudget` and `Soalan x / questionCount` next to each Bahagian (Set Builder shows a fill count only); (2) explicit `Simpan draf` with the unsaved-changes guard; (3) `Tulis soalan baharu` inline, the new question waiting in review ("Soalan baharu menunggu semakan"); (4) the link `Lihat di Bijak SPM`; (5) `Sembunyikan` next to `Tarik balik ke draf`. Functions both already have (no move): add from bank with groups as one unit, `Naik`/`Turun`, `Buang`/`Buang kumpulan`, student-view preview, `Terbitkan`, copy and copy-for-edit, edit contract, open builder.
- **No function lost:** the Set Builder must have (S3-T02): Jana set with Tahun/Negeri/Bilangan, "Jawab Semua / Pilih N" control, group as a unit in the bank panel, blueprint budget check (a Disahkan contract is enforced; no contract: V2 behaviour, `Terbit` asks for the audited exception, AC-ADM-Q13.2). Today these are missing (gap F4, Q-14).
- **Cards / PRD:** S3-T02 (owner), S2-T03 (redirect), S0-T07. PRD 30 1.1 row 3; 3.3 row KS-09; 4.V rows Q-13, Q-14, Q-15; plan "decision 2" (line 46).
- **Proof:** AC-ADM-Q13.1/13.2, AC-ADM-Q14.* , AC-ADM-Q15.1..3, AC-ADM-Q07.5.
- **Do NOT:** do not delete `PaperEditorPage` before the Set Builder has the budget check, preview and publish. Do not create a third builder. Do not rename the paper id route that the lane row `Sunting` and the batch-to-paper link (`Semak & Terbit`) use without a redirect.

### M-06 Three editors for one question
- **Plain description:** There are three pages that edit a question: the old flat form, the Studio wizard and the SPM Quick Edit.
- **Where (verified):**
  - Old: `/admin/questions/create` and `/admin/questions/:id/edit` (`m04 routes/questions-form.ts:18,24`; `QuestionCreatePage.vue`, `QuestionEditPage.vue`).
  - Studio: `/admin/studio/questions/create` and `/admin/studio/questions/:id/sunting` (`routes/studio.ts:18,24`; `StudioEditorPage.vue`), group page `/admin/studio/groups/:id` (`:31`).
  - Quick Edit: `/admin/spm/soalan/:qid/sunting` (`admin-papers.ts:50`; `BankEditPage.vue`).
- **Keep:** Studio wizard (PRD Q-04, QE-02..QE-04, group-first entry D93) for create/edit. Quick Edit is "Keep" in PRD (Q-24, S2-T05) and is the edit target of the SPM lanes.
- **Action:** old flat form: **DECIDED (D113):** `/admin/questions/create` and `/admin/questions/:id/edit` REDIRECT to Studio `/admin/studio/questions/create` and `/admin/studio/questions/:id/sunting` with the V2 notice "Borang soalan lama telah dipindahkan ke Studio. Sila cipta soalan baharu di sini." (30 line 736). The `Tambah Soalan` button of `Senarai Soalan` goes to Studio. The redirect is switched on only after a field-by-field comparison; any field missing in Studio is added first. Old form fields (`QuestionForm.vue`): Subjek, Tahap Pendidikan, Bab, SP, Tahap Kesukaran, Jenis Soalan, Teks Soalan, Gambar Soalan (Pilihan), Pilihan with the correct answer, and the Arabic/Jawi keyboard (`ArabicKeyboardPanel.vue`). Studio already has subject, level, Bab, TP/KBAT, answer types, per-option text and images, stimulus image. Fields to verify and, if missing, add to the Studio editor first: (1) the Arabic/Jawi keyboard for question text and options; (2) a question-level single image `Gambar Soalan` (a 1-member group may cover it; confirm); (3) the free `Jenis Soalan` values used by legacy rows. The developer verifies it field by field in card S2-T01 before the redirect is switched on.
- **No function lost:** the old form's fields must all exist in the Studio wizard (the wizard is a superset by design: DSKP tags, Bab, difficulty, groups). Verify field by field before redirecting. The developer verifies it field by field in card S2-T01 before the redirect is switched on.
- **Cards / PRD:** S2-T01, S2-T05, S2-T03. PRD 30 4.V rows Q-04, Q-20, Q-24; FR-ADM-QE2.*, QE3.*.
- **Proof:** AC-ADM-QE1.* to QE4.* on the Studio wizard; route table test for the redirect.
- **Do NOT:** do not add DSKP/group logic to the old form. Do not redirect before the field comparison. Do not break `/admin/questions/:id` (detail, `QuestionDetailPage.vue`) which `Senarai Soalan` rows use.

### M-07 Separate menu items for what V2 shows as tabs
- **Plain description:** "Kualiti Soalan", "Laporan Soalan", "Kiriman Guru" (and "Soalan Berstruktur") are separate or invisible items; V2 shows them as tabs of one page or inside Import & Semakan.
- **Where (verified):** `BS-04 Kualiti Soalan` `/admin/questions/quality` (`menu.ts:98`, `routes/quality.ts:11`); `BS-05 Laporan Soalan` `/admin/question-reports` (`menu.ts:99`, `routes/reports.ts:14`); `/admin/question-submissions` (no menu id, `routes/submissions.ts:11`); `/admin/structured-questions` (no menu id, `routes/structured.ts:12`).
- **Keep (decided):** tabs `Kualiti`, `Laporan` inside `Senarai Soalan` (V2 tabs `Senarai`, `Kualiti`, `Laporan`); tab `Kiriman Guru` inside `Import & Semakan`; `Soalan Berstruktur` as its own sub-item under `Bank Lama (Legasi)`.
- **Action:** BS-04, BS-05: MERGE (tabs; routes unchanged). Kiriman Guru: MERGE (tab). Soalan Berstruktur: KEEP (add menu item).
- **No function lost:** all four screens keep their own pages and routes; only the menu entry changes. Row actions of Laporan Soalan (Arkib / Tolak) must be verified (gap 5.1, S2-T06).
- **Cards / PRD:** S0-T07, S2-T06, S2-T02. PRD 30 3.3; Q-21, Q-22, Q-23, Q-12.
- **Proof:** AC for Q-21..Q-23 and Q-12; menu snapshot test.
- **Do NOT:** do not move the routes; the tabs link to the same URLs.

### M-08 Hidden SPM placeholders and merged-away items
- **Plain description:** The old menu definition holds placeholders that repeat hub lane cards (KS-03..06) or functions that now live inside Tracking A (KS-11, KS-12) or are AI (KS-10).
- **Where (verified):** `menu.ts:117-121` (KS-03 `Latih Tubi`, KS-04 `Tracking A`, KS-05 `Subjektif`, KS-06 `Bijak SPM (Simulasi)`, KS-07 `Kertas Subjektif`) and `:125-127` (KS-10 `Tanda Karangan`, KS-11 `Ramalan SPM`, KS-12 `Set Soalan`). None has a route (`built:false`).
- **Keep (decided):** hub `SPM` (`/admin/spm`, KS-01) with 6 lane cards, and group `SPM` items `Databank Soalan`, `Latih Tubi`, `Tracking A`, `Subjektif`, as in V2. KS-06 only as hub lane card `/admin/spm/simulasi`. KS-07 `Kertas Subjektif` is built as its own item.
- **Action:** KS-03, 04, 05, 06: MERGE (they become the hub cards and group items). KS-10, 11, 12: REMOVE from the definition (AI, D73; merged into Tracking A, PAR A26).
- **No function lost:** the hub currently has 2 of 6 lane cards (`admin-kandungan.ts:13-29`), so KS-03..05 only disappear once the lanes are built (S3-T03, Q-02). Do not remove the placeholders for lanes that are not built yet unless the replacement exists.
- **Cards / PRD:** S0-T07, S3-T03. PRD 30 3.3; Q-01, Q-02.
- **Proof:** Hub shows 6 lanes (S3-T03 test "hub counts equal list counts"); menu snapshot.
- **Do NOT:** do not show an item for an unbuilt lane (AC-ADM-H0.1). Do not delete KS-xx data rows that other docs cite until the codes are re-mapped.

### M-09 Admin menu item opens the teacher route
- **Plain description:** The admin menu item "Monitoring" goes to `/guru/monitoring`, a teacher route.
- **Where (verified):** `menu.ts:62` `['PM-03', 'Monitoring', '/guru/monitoring']`. The same component set is also mounted at `/admin/monitoring` by M17 (`m11-teacher-analytics/index.ts:19`).
- **Keep (decided):** `/admin/monitoring`, group ANALITIK.
- **Action:** RE-POINT the item. The two mounts of one component set are by design (see section 6), not a duplicate to merge.
- **No function lost:** none, same components.
- **Cards / PRD:** S0-T07, S6-T08. PRD 30 3.4 row PM-03; GAP 6.
- **Proof:** AC-X2-1 (no redirect to another role's screen); menu snapshot.
- **Do NOT:** do not copy `MonitoringPage.vue`; keep one component set with a route prefix prop.

### M-10 "SPM Mock Exam" twice in the pupil menu, and a second mock-exam product
- **Plain description:** The pupil menu lists "SPM Mock Exam" twice (AI section and Killer Features), both to `/spm-mock`, and it is an older mock-exam engine next to Bijak SPM.
- **Where (verified):** `src/shells/nav/user-nav.ts:325` (`spm-mock-ai`) and `:431` (`spm-mock`), both `/spm-mock`; Bijak SPM `bijak-spm` `/spm/bijak` at `:225`. Backend `spm/mocks.controller.ts` (`/api/spm-mocks`), table `spm_mock_exams` / `spm_mock_exam_items` (`spm.prisma:65,91`).
- **Keep (DECIDED D113):** Bijak SPM `/spm/bijak` is the single exam engine. (Fact: R1 hides the old module, 10-murid line 102; V2 shows both entries, but D113 chooses one engine.)
- **Action (DECIDED D113):** `/spm-mock` REDIRECTS to `/spm/bijak`; both nav entries (`user-nav.ts:325`, `:431`) are removed. `spm_mock_exams` / `spm_mock_exam_items` get no new writes. Existing attempts stay readable (in Sejarah) only if the UAT count is above 0: the UAT developer runs a read-only count on `spm_mock_exams`; if 0, the table and `spm/mocks.controller.ts` are retired.
- **No function lost:** a timed full-paper mock with auto-grade is what Bijak Simulasi does (modes `simulasi`, `tracking_a`).
- **Cards / PRD:** S0-T05 (scope). PRD 10 line 102; 60 API-BIJAK-08.
- **Proof:** a pupil typing `/spm-mock` gets the standard 404 page (D108(7), FR-X2-2).
- **Do NOT:** do not wire `spm_mock_exam_items` into reports; do not add features to it; do not make a third mock engine.

### M-11 Admin Pusat items in the old nav files
- **Plain description:** Admin Pusat has its own menu (`pentadbiran/menu.ts`), but the older nav files also hold admin items (for example `Urus Hadiah`, `Admin Tebusan`, `Kelulusan Hadiah`) and a second admin-panel menu definition.
- **Where (verified):** `src/shells/nav/user-nav.ts:462` (`kelulusan-hadiah`), `:479` (`admin-tebusan`), `:567` (`urus-hadiah` -> `/admin/hadiah`); `src/shells/nav/admin-nav.ts` (`ADMIN_NAV`, F-18 shell `src/shells/admin/AdminShell.vue`). The router sends role `admin` to the Pentadbiran shell (`src/app/router/layouts.ts:47-50`), so these entries are not rendered for Admin Pusat today.
- **Keep (DECIDED D113):** `src/shells/pentadbiran/menu.ts` is the only admin menu (S0-T07).
- **Action:** REMOVE the Admin Pusat items from `user-nav.ts` (`kelulusan-hadiah` :462, `admin-tebusan` :479, `urus-hadiah` :567 and any other item whose roles are admin only) and delete `admin-nav.ts` `ADMIN_NAV` once nothing imports it (check `AdminShell`, `ShellPreviewAdmin` first). Do not add admin items to any other nav file.
- **No function lost:** n/a.
- **Cards / PRD:** S0-T07 (menu), S0-T06. PRD 30 section 3.
- **Proof:** the sidebar walk (AC-X2-1) per role.
- **Do NOT:** do not add or edit admin entries in `user-nav.ts` or `admin-nav.ts` for Admin Pusat work.

---

## 2. Routes and pages

### R-01 Papan Pendahulu: two URLs, two pages, two APIs
- **Plain description:** The leaderboard exists twice. Different URLs open different pages with different data.
- **Where (verified):**
  - `/leaderboard`, page `m08-student-performance/pages/LeaderboardPage.vue`, route `m08 routes/ranking.ts:25`, API `GET /api/leaderboard` (`m08 api/performance.ts:104-106`; backend `reports/performance/http/social.controllers.ts:58`). Linked from the pupil dashboard (`m05-practice/components/dashboard-v2/HomeQuickActions.vue:62`).
  - `/gamification/leaderboard`, page `m14-gamification/pages/student-b/LeaderboardPage.vue`, route `m14 routes/student-b.ts:13`, API `GET /api/gamification/leaderboard` (`m14 api/student.ts:80-82`; backend `gamification/gamification.controller.ts:69`, which ignores period and every query). Used by the sidebar (`user-nav.ts:464`).
- **Keep (DECIDED D113):** `/leaderboard` is canonical (the pupil dashboard links to it, `HomeQuickActions.vue:62`). FR-MUR-33 (scope tabs `Kelas`/`Sekolah`, period tabs `Semua Masa`, `Minggu`, `Bulan`, "Kedudukan Anda" tiles, ranking by syiling) is built on that page.
- **Action:** `/gamification/leaderboard` REDIRECTS to `/leaderboard` (FR-MUR-33-5). Change the sidebar item `papan-pendahulu` (`user-nav.ts:464`) to `/leaderboard`. Delete `m14-gamification/pages/student-b/LeaderboardPage.vue` and its route (`routes/student-b.ts:13`) after the redirect ships. API: see P-02.
- **No function lost:** the m08 page shows `period` filtered ranking by accuracy (S20, FR-M08-113..118). The kept page ranks by syiling. Check whether any m08-only content (period filter, `LeaderboardPodium.vue`) is wanted; the PRD ranks by syiling only (FR-MUR-33-2) and `/ranking` "Kedudukan" (R1-MUR-18) is the accuracy/other ranking. Podium component reuse is allowed.
- **Cards / PRD:** S7-T06. PRD 10 R1-MUR-33 (lines 1191-1198), FR-MUR-33-1..5; 60 API-GAME-06, API-RPT-13; plan line 1046.
- **Proof:** AC-MUR-33-1..4 plus: Given a pupil opens `/leaderboard`, then the URL becomes `/gamification/leaderboard` and the dashboard shortcut opens the same page.
- **Do NOT:** do not leave both pages live. Do not delete `/api/leaderboard` before `/ranking` and any other caller are checked (API-RPT-13 still lists it). Do not show full names of other pupils (first name only, D-A12).

### R-02 Kedai Hadiah and Kedai Hadiah Digital
- **Plain description:** Two pupil pages sell gifts; the digital one reads an endpoint that always returns an empty list.
- **Where (verified):** `/gamification/rewards` "Kedai Hadiah" (`m15 routes/student.ts:15`, `RewardsShopPage.vue`; sidebar `user-nav.ts:461`) and `/cikgu/hadiah` "Kedai Hadiah Digital" (`m15 routes/digital.ts:14`, `DigitalShopPage.vue`; sidebar `:471`). Digital API `GET /api/hadiah-digital/items` and `.../redemptions` return `[]` always (`m15 api/user.ts:31-47`; backend `shop/shop.controller.ts:34,39`). The real catalogue table is `rewards` (`shop/shop.repository.ts:58`).
- **Keep (decided, FD-MUR-33):** one catalogue, two entry points: both pages are views of the same digital-gift catalogue and share stock and token balance.
- **Action:** POINT `/cikgu/hadiah` at the shared catalogue (S7-T05); `Tebusan Saya` lists the same redemptions on both. Both routes stay (V2 shows the digital catalogue through the rewards page and as a block in Syiling & Token). `/cikgu/hadiah` must not be blocked by the Alesa flag (D73 hides `/cikgu` chat only).
- **No function lost:** category filter, `Tebusan Saya`, "Tiada hadiah" state of the digital page stay.
- **Cards / PRD:** S7-T05. PRD 10 R1-MUR-31, R1-MUR-38 (FR-MUR-38-1..4), FD-MUR-33; 60 API-GAME-08.
- **Proof:** AC-MUR-38-1 (a gift redeemed here also appears in row 31 `Tebusan Saya`, same token balance), AC-MUR-38-2 (Alesa hidden, page still opens).
- **Do NOT:** do not copy catalogue data into a second table. Do not keep an endpoint that returns `[]` as the page's data source.

### R-03 "Laporan Mingguan": sidebar and real page differ
- **Plain description:** The teacher sidebar item "Laporan Mingguan" opens a 403 page; the real route shows a "not available" page.
- **Where (verified):** `user-nav.ts:233` (`laporan-mingguan`), `:287` (`t-laporan-mingguan`), `:532` (`guru-laporan-mingguan`), all `/laporan-mingguan` (route `m08 routes/prestasi.ts:95`, `roles: []`, always 403) versus `/guru/laporan-mingguan-kelas` (`m11 routes/laporan-mingguan.ts:14`, currently `PrototypeUnavailablePage`). Backend `GET /api/weekly-report` always 403 (see P-06).
- **Keep (decided):** `/guru/laporan-mingguan-kelas` for the teacher (alias `/guru/laporan-mingguan`; the alias is not in the code yet); the pupil/parent `/laporan-mingguan` is unchanged and hidden.
- **Action:** RE-POINT the sidebar items (S0-T06). Build the teacher page (S6-T01).
- **No function lost:** the 403 page has none.
- **Cards / PRD:** S0-T06, S6-T01. PRD 20 line 836 (R1-GUR-43); gap row GUR 43.
- **Proof:** AC-X2-1 / AC-SH-* sidebar walk: opens a titled screen with no 403/404.
- **Do NOT:** do not make `/laporan-mingguan` serve the teacher report (it is the pupil/parent screen).

### R-04 V2 URLs and V3 URLs for the same admin page
- **Plain description:** V2 uses different URLs from the built V3 routes. The plan keeps the built V3 route as canonical and adds the V2 URL as a redirect.
- **Where / list (doc says; code checked):**

  | V2 / PRD URL | V3 canonical (built) | State in code |
  |---|---|---|
  | `/admin/studio/imports` | `/admin/spm/soalan/ekstrak` | alias missing |
  | `/admin/studio/questions/{id}/edit` | `/admin/studio/questions/:id/sunting` (`routes/studio.ts:24`) | alias missing |
  | `/admin/studio/questions/{id}/preview` | none | route missing |
  | `/admin/spm/kertas-subjektif` | `/admin/kertas-subjektif` | neither built |
  | `/admin/spm/kertas` (list) | `/admin/studio/sets` | redirect missing |
  | `/admin/spm/soalan` (list) | `/admin/spm/databank` | redirect missing |
  | `/admin/spm/semakan` (list) | `/admin/studio?status=review` | redirect missing |
  | `/admin/questions/create`, `/:id/edit` | Studio create/sunting | DECIDED D113 (M-06): redirect after field comparison |
- **Keep (decided, D107, 30 section 3.2):** canonical = the existing built route; the V2 path = alias redirect.
- **Action:** ADD redirects in the route files (`m04-question-bank/routes*`, `m28-bijak-spm/routes/*`).
- **No function lost:** none.
- **Cards / PRD:** S2-T03. PRD 30 3.2, 3.3.
- **Proof:** S2-T03 test "route table: every alias resolves, no 404".
- **Do NOT:** do not rename the canonical routes (other screens link to them). Do not create a redirect loop. Do not use `reviewed` in the redirect (value is `review`).

### R-05 Same page by two URLs on purpose
- **Plain description:** Some pages have two URLs by design because V2 has both. They are not defects.
- **Where (verified / doc says):** `/panduan` and `/pusat-tuisyen/panduan` (`m09 routes/panduan.ts:12,18`, same `PanduanPage.vue`; one public, one needs login); `/guru/set-soalan/cipta` accepts V2 `/guru/set/cipta`; `/guru/misi-harian` with `/cipta` redirecting to the create card.
- **Keep / Action:** KEEP both, one component. **Do NOT** merge them or add a second component.

---

## 3. Data structures

### S-01 Four parallel curriculum structures
- **Plain description:** The syllabus is stored in four different table sets. Pupil screens read the wrong, empty one.
- **Where (verified):** (a) `chapters/topics/subtopics` (pupil Bab tree, V2 data); (b) `curriculum_nodes` + `curriculum_tp_descriptors` (DSKP tree, loaded by script) in `curriculum.prisma`; (c) `dskp_bidang/dskp_sk/dskp_sp` (teacher picking list, `classes.prisma`; read by `questions/workflow/dskp/dskp.service.ts` and `classes/question-sets/question-sets.repository.ts`); (d) `legacy_topics/legacy_subtopics` (prototype seed). Pupil Topik and Peta Belajar read (d): `curriculum/learner.service.ts:73,80,110`. Empty on UAT.
- **Keep (decided):** (a) for everything the pupil sees as Bab/Topik/Peta Belajar (DM-16); (b) for question tags (unit/SP/TP), heatmaps and blueprints (DM-19); (c) stays only as the teacher picking list (DM-15, OD-5: not retired in R1); (d) is retired.
- **Action:** (d): SWITCH READER to (a); keep the tables, drop them in a later release. (c): KEEP, never join to (b). No migration.
- **No function lost:** (d) supplies grade+subject-coded topics with an emoji icon for Peta Belajar; the replacement must supply icon/sequence or the V2 look (FR-MUR-25). DSKP SP progress shown only where (b) nodes exist (FR-MUR-DK-5). T1-T3 have no DSKP nodes yet (D109, S4-T09).
- **Cards / PRD:** S5-T12, S4-T06 (reader), S4-T07, S4-T09; PRD 50 F5, DM-15, DM-16, OD-5; 10 R1-MUR-24/25.
- **Proof:** AC-MUR-25-1..3 (a Sains chapter appears as an island for T1 and T5), AC-MUR-DK-1.
- **Do NOT:** do not delete `legacy_topics` before the reader switch ships. Do not write question tags into `dskp_*`. Do not add a fifth structure.

### S-02 Pupil answers written to many tables
- **Plain description:** Each activity stores answers in its own table, so reports that read one table miss the others (same pupil shows 122 / 30 / 36 answers on three screens).
- **Where (verified in `apps/api/prisma/schema`):** `practice_answers` (`practice.prisma:85`, no `mode` column yet), `attempt_answers` + `attempt_results` (Bijak, `bijak-attempts.prisma:57`), `practice_attempt_aggregates(+items)` (Bijak summary), `structured_attempts` (`practice.prisma:286`), `battle_answers` (`battle.prisma:86`), `game_session_items` (`games.prisma:132`), `spm_mock_exam_items` (`spm.prisma:91`), `pksk_exam_attempts` (`pksk.prisma:75`), `audio_kbat_attempts`, `remedial_test_items`.
- **Keep (decided, D-A1, DM-44, FR-X4-5):** `practice_answers`, with new columns `mode`, `attempt_id`, `part_ref`, `marks_awarded`, `marks_max`, written only through one port `AnswerLogPort.record(...)`. `practice_attempt_aggregates` stays as the Bijak result-screen detail only.
- **Action:** MIGRATE: add columns nullable, backfill `mode` from `practice_sessions.mode`, then NOT NULL, check and partial unique index `(attempt_id, user_id, question_id, coalesce(part_ref,''))` (migration `0181_s5_answer_store_mode`). Past Bijak sittings are backfilled by script (`uat-ops/backfill-bijak-answers.ts`, dry-run first). Writers: Latih Tubi, chapter, revision, remedial, mission, pksk, databank, question_set, kuiz, simulasi, tracking_a, subjektif, game (registry in 50 section 4.7a).
- **DECIDED (D113):** the registry of `practice_answers.mode` adds four modes: `structured` (Latihan Berstruktur, `structured_attempts`), `battle` (Battle Arena, `battle_answers`), `pksk` (PKSK exam, `pksk_exam_attempts`; `pksk` already exists as a session mode, now also an answer mode) and `audio_kbat` (`audio_kbat_attempts`). Each of these flows ALSO writes `practice_answers` rows through the port (D-A1); their attempt tables keep session-level data only (score, timing, positions). `spm_mock_exam_items` gets no writes (M-10). **Note:** `practice_answers.mode` itself is a DM addition not yet in the schema (`PracticeAnswer` has no `mode` column; DM-44, migration `0181_s5_answer_store_mode`); the check `ck_practice_answers_mode` lists the existing session modes plus `databank`, `kuiz`, `simulasi`, `tracking_a`, `subjektif`, `game`, `structured`, `battle`, `audio_kbat`.
- **No function lost:** each source table keeps its own detail (attempt payloads, battle positions) where it has non-answer data; only the "answer count / correct" fact moves to the single store. A self-mark replaces the row, never adds.
- **Cards / PRD:** S5-T15 (owner); S3-T04, S3-T05, S3-T06, S5-T11, S7-T01 (writers); S10-T02, S6-T03 (readers). PRD 40 FR-X4-5; 50 DM-44; 20 section 5 XS-8.
- **Proof:** AC-XS-4 (10 Latih Tubi + 40 Bijak answers = 50 on every screen), AC-CHAIN-1, 3, 4; test "a module inserting into `practice_answers` without the port fails the build".
- **Do NOT:** do not insert into `practice_answers` directly. Do not drop the sidecar tables in R1. Do not read answers from `practice_attempt_aggregates` for Soalan Dijawab / Ketepatan. Run the migration in batches (hot table).

### S-03 Paper-like containers
- **Plain description:** Several tables hold "a set of questions for a pupil to sit": admin papers, teacher sets, Tracking A sets, old mock exams, import batches, source papers.
- **Where (verified):** `papers` + `paper_sections` + `paper_placements` (`exam.prisma`); `question_sets` + `question_set_items` (`classes.prisma`); `spm_tracking_sets` + `spm_tracking_set_questions` (`spm.prisma`); `spm_mock_exams` (`spm.prisma:65`); `intake_batches` (`intake.prisma`); `source_papers` (`questions-workflow.prisma`).
- **Keep (decided, by purpose):** `papers` is the one admin paper (Bijak Simulasi; Kertas Subjektif is `papers` with `surface='subjektif'`, DM-23, which supersedes ADR-0033). Teacher set and teacher Kertas Peperiksaan are `question_sets` (`kind='set'|'kertas'`, DM-43), no new table. Tracking A sets stay (ADR-0032 as amended by DM-24). An accepted import batch becomes a draft `papers` row (`papers.source_batch_id`, DM-45). `source_papers` is a read-only registry over batches and migrated papers (API-Q-23).
- **Action:** KEEP by purpose; no merge. `spm_mock_exams`: no new writes, retired (DECIDED D113, see M-10, P-07).
- **No function lost:** n/a (no table removed).
- **Cards / PRD:** S3-T02, S3-T05, S3-T06, S6-T14, S6-T20, S1-T10. PRD 50 DM-23, DM-24, DM-43, DM-45, OD-2.
- **Proof:** AC-ADM-Q18.*, AC-ADM-Q17.*, AC-GUR-44e, AC-CHAIN-2.
- **Do NOT:** do not create a new table for teacher papers or Kertas Subjektif. Do not let a question appear twice in sibling Tracking A sets (DM-24).

### S-04 A stimulus can be attached three ways
- **Plain description:** A figure/passage can be attached to a question, to a part of a question, or to a group of questions; and an intake copy exists during import.
- **Where (verified/doc):** `stimulus_groups` + `stimulus_group_stimuli` + `questions.group_id/group_position` (built); `question_version_stimuli` (question-level); `question_parts.stimulus_id` (part-level); `intake_stimuli` (import stage). Doc: 50 F1, DM-03, INV-08.
- **Keep (decided, D90, D108(1), DM-03):** the stimulus group (1..n questions) for all new entry; question-level and part-level stay valid for existing data (and Sejarah (c) parts). New Studio entry always creates a 1-member group. The projection returns a `group` shape for both so drills never serve a stimulus-using question without it. No backfill.
- **Action:** RULE (no schema). Code still requires 2 or more members (F2): change to 1..n (DM-01).
- **No function lost:** n/a.
- **Cards / PRD:** S1-T01. PRD 40 FR-X1-4a..f; 50 DM-01, DM-03; 30 QE-01, QE-02.
- **Proof:** AC-ADM-QE1.1, QE1.2; golden test of S1-T03 (Rajah 3 -> Q5-8 gives 1 stimulus).
- **Do NOT:** do not copy a stimulus per question. Do not remove question-level/part-level support. Do not add the "at least 2 members" rule back.

### S-05 Two reward catalogues
- **Plain description:** The pupil shop reads one reward table; the admin screen "Kawalan Reward" edits costs on another table.
- **Where (verified):** pupil shop and admin `/admin/hadiah`: `rewards` + `reward_redemptions` (`shop/shop.repository.ts:58-72`, `shop/admin.service.ts`). Admin `/admin/reward-control` cost edits: `syiling_rewards` + `reward_claims` (`gamification/admin.service.ts:482`, `gamification.repository.ts:692-700`; nothing else reads them). The docs list both entities (50 line 1175) and never say they are one catalogue.
- **Keep (DECIDED D113):** `rewards` + `reward_redemptions` (the tables the pupil shop reads, `shop/shop.repository.ts:58`). V2 Kawalan Reward shows `Hadiah`, `Kategori`, `Harga Token`, `Kos Sebenar`, `Status`, which is that catalogue.
- **Action:** switch the admin Kawalan Reward cost screen (`gamification/admin.service.ts:482`, `gamification.repository.ts:692-700`) to `rewards`; MIGRATE the data of `syiling_rewards` (cost in sen) and `reward_claims` into `rewards` (cost field), `reward_redemptions` and `reward_settings` (budget); then retire `syiling_rewards` and `reward_claims`.
- **No function lost:** list the fields of `syiling_rewards` (cost in sen, budget) and put them on `rewards` or `reward_settings`.
- **Cards / PRD:** S7-T05. PRD 30 R1-ADM-P2-09; 50 DM-48.
- **Proof:** Acceptance to add: Given the admin changes a reward cost in `Kawalan Reward`, then the pupil shop shows the new cost.
- **Do NOT:** do not build the Kawalan Reward screen on `syiling_rewards` while the shop sells from `rewards`.

### S-06 Two sources for the coin rate
- **Plain description:** The coins a pupil earns per correct answer come from a code constant in one place and a setting in another.
- **Where (doc says):** `MISSION_COINS_PER_CORRECT = 3` versus flat 1 syiling per correct answer (50 DM-48, finding F-12); the admin `flatCoins` setting exists (`gamification/admin.controller.ts:122-143`, P2-09).
- **Keep (decided, D-A11):** new singleton table `reward_settings` (`coins_per_correct` default 1, `redeem_budget_sen` 300, `session_year`, `mini_games_give_coins` false). Every mode's wallet credit reads it. The mission's teacher-set `rewardCoins` is paid once at the target.
- **Action:** MIGRATE (create the table with the observed V2 defaults), REMOVE the constant, no fallback (migration `0223_s7_reward_settings`).
- **No function lost:** mission per-answer Syiling uses the same rate.
- **Cards / PRD:** S7-T05. PRD 50 DM-48; 30 FR-ADM-P2-09.1..3; 10 FR-MUR-16-7.
- **Proof:** AC-ADM-P2-09.2.
- **Do NOT:** do not leave a hard-coded coin number in any module (also AC-XS-3).

### S-07 One column, two meanings (TP and difficulty)
- **Plain description:** The thinking level (TP 1-6) and the difficulty (1-5 stars) are saved in the same column, `difficulty_tp`.
- **Where (doc says; code line refs from the PRD):** `questions/projection.ts:14`, `questions.service.ts:293`; labels in `m05-practice/components/quiz/practice-config.ts:12`, `projection.ts:98`.
- **Keep (decided, D-A6, DM-47):** two columns: `difficulty_tp` (DSKP, 1..6) and new `difficulty_level` (1..5, `min(5,TP)` when a TP exists). One label mapping `1 Sangat Mudah ... 5 Sangat Sukar`.
- **Action:** ADD column and backfill by script in batches (`0128_s1_difficulty_level`).
- **No function lost:** all readers (Latih Tubi, Databank, Set Soalan pickers, Guru star filter) read `difficulty_level` only.
- **Cards / PRD:** S1-T02. PRD 50 DM-47; AC-ADM-QE3.1.
- **Proof:** AC-ADM-QE3.1.
- **Do NOT:** do not show TP and difficulty as the same field; do not write teacher stars into `difficulty_tp`.

---

## 4. Data content

### C-01 A figure stored as its own "question", and its questions left without it
- **Plain description:** In the old data a diagram became a "question" with no marks, and the questions that say "Rajah 14 menunjukkan ..." lost their diagram. Pupils get questions without a figure.
- **Where:** UAT (not reproducible locally): Sains T4 id 812791 (Rajah 14), and "Rajah 11/9/7" rows are published with no figure. Detection rule FR-ADM-G7.1; flag column `question_versions.stimulus_flag` (`stimulus_missing`, `figure_only`; DM-05, to be built).
- **Keep (decided):** a stimulus group (D90). A figure is never a question (FR-ADM-QE1.1).
- **Action:** REGROUP by an admin in the work-list (S2-T04): create `stimulus` + group, attach members, ARCHIVE the figure-only question with `archive_reason='regrouped'` (DM-06). Until fixed, flagged questions are excluded from every pupil surface by a servability reason (not a status change).
- **No function lost:** the figure's text and image move into the stimulus; no content is invented; images are never copied; an audit row is written. Content work (supplying figures) is done by ADMIN users, not by developers or scripts (D110).
- **Cards / PRD:** S1-T07 (detector, flag), S2-T04 (work-list), S4-T04 (report script). PRD 30 4.G.7, QE-08, FR-ADM-G7.1/G7.3/G7.4/G7.5; 40 FR-X1-4f; 50 DM-04, DM-05, DM-06; 60 API-Q-12, Q-13, Q-24.
- **Proof:** AC-ADM-G7.1, AC-ADM-G7.2 (E2E).
- **Do NOT:** do not delete the figure-only row (archive it). Do not guess figures. Do not run a UAT write without the user's approval and a dry-run (FR-X5-3). Do not let "served lock" block the regroup (DM-04).

### C-02 Stem repeated in the stem and in the only part prompt
- **Plain description:** The question text appears twice (as the heading and again as "(1) ...").
- **Where:** same UAT rows as C-01; flag `stem_duplicated`.
- **Keep (decided, OD-3, 2026-11-04):** one copy. The question is complete and answerable, so it is **not** excluded from pupil surfaces; the display shows it once (FR-MUR-QP-5) and the data is cleaned.
- **Action:** RENDER once now (S1-T07); CLEAN by one-off trim script that copies the old values to `_bk_r1_trim_duplicate_stem` first, dry run, report, user approval, real run by the designated UAT developer (DM-40, U-OP-06, S4-T04).
- **No function lost:** only the duplicated leaf prompt (equal to the stem) is removed.
- **Cards / PRD:** S1-T07, S4-T04. PRD 30 FR-ADM-G7.2, G7.6; 50 DM-40, OD-3; 10 FR-MUR-QP-5; 60 API-Q-12.
- **Proof:** AC-ADM-G7.3 (Studio preview and pupil view show the text once).
- **Do NOT:** do not exclude `stem_duplicated` questions (OD-3). Do not run the trim without the backup table.

### C-03 A shared figure copied for each question
- **Plain description:** V2 import links a figure only to the first following question and makes a new figure row and image for each question.
- **Where:** V2 code evidence (`DocxSetParser.php`, `DocxSetImporter.php:279-296`) quoted in 40 FR-X1-4; V3 intake: `apps/api/src/modules/intake/workflow/figure-links.ts` and FE twin `m28-bijak-spm/admin/intake/domain/figure-links.ts`.
- **Keep (decided, FR-X1-4c):** one stimulus per figure, referenced by all questions that cite it ("Rajah 3 -> soalan 5-8").
- **Action (DECIDED D113):** NEW imports store once. EXISTING duplicate stimuli: new U-OP step **U-OP-18**: the designated UAT developer runs `group-integrity.sql` as a read-only dry-run on UAT and hands the report to the admin; the admin merges the duplicates through the regroup work-list (QE-08, S2-T04); the unique index `stimulus_group_stimuli.stimulus_id` (INV-08, DM-02b) is applied only when a re-run shows 0 (OD-13).
- **No function lost:** the reviewer can fix the group range before Terima.
- **Cards / PRD:** S1-T03, S1-T01. PRD 40 FR-X1-4c; 50 INV-08, DM-02, OD-13; 30 QE-05.
- **Proof:** S1-T03 golden test: Rajah 3 -> Q5-8, Rajah 4 -> Q9 gives 2 groups, 5 members, no duplicate figure, paper carried; AC-ADM-QE1.2 (one stimulus row).
- **Do NOT:** do not "fix" by editing images in place. Do not add the unique index before the report shows 0.
- **Note:** the same FE logic exists twice (BE and FE twin of `figure-links.ts`). Keep them in step; do not create a third copy.

### C-04 Rows that can be inserted twice
- **Plain description:** Several places allow the same thing to be saved twice, giving duplicate records.
- **Where / guard (doc says):**
  - the same question in two sibling Tracking A sets of one subject and year: unique `(subject_id, year, question_id)` on `spm_tracking_set_questions` (DM-24; today only `validateSave` checks);
  - two draft papers for one accepted batch: `papers.source_batch_id` unique where not null (DM-45); a second accept updates (HTTP 200), not duplicates;
  - repeated Bijak submit or late self-mark: partial unique `(attempt_id, user_id, question_id, coalesce(part_ref,''))` (DM-44);
  - repeated pupil report on one question version: 409/422 (API-Q-19);
  - repeated CSV/DSKP load: report counts and no duplicates (AC-ADM-C04.1).
- **Keep / Action:** ADD the constraints named; run an orphan/duplicate report first and fix data before the constraint (the migration fails otherwise).
- **No function lost:** n/a.
- **Cards / PRD:** S3-T05, S1-T10, S5-T15, S4-T02. PRD 50 DM-24, DM-44, DM-45, DM-46 (set/classroom unique).
- **Proof:** AC-ADM-Q17.1..3, AC-ADM-Q07.3/07.4, AC-XS-4, AC-ADM-C04.1.
- **Do NOT:** do not add a unique index blind; do not delete user data to make an index succeed.
- **Not related:** the code term `DuplicateLink` and `POST /api/intake/items/:id/duplicate` (`intake.prisma`; endpoint list in 60) mean near-duplicate detection inside intake; the docs never explain them (see glossary).

---

## 5. Code paths and API

### P-01 Mock path and real path
- **Plain description:** The front end can run on an in-browser mock or on the real API. Many screens still contain mock-only data or "not available" stubs.
- **Where (verified):** `src/api/mode.ts:1` (`VITE_API_MODE=http` real API, anything else mock); 23 `src/modules/*/mock/` folders; `src/mock/**`; `m27-school-admin/mock/read-models/*` (usage, users-list, school-people ...); stubs `UnavailablePaperIntake` (`question-sets.ports.ts:46,56,63`, teacher PDF submit answers 503), `lib/submissions-unavailable.ts:7`; empty route files `m17/routes/{dashboard,analytics,laporan,laporan-eksekutif}.ts` (PRD claim; `laporan-eksekutif.ts` does have an S8 header comment, so check before deleting); `AI_PROVIDER=mock`.
- **Keep (decided, D100, FR-X2-0, AC-X2-2):** the real API only for every matrix screen.
- **Action:** DELETE mock data paths sector by sector as part of each card; S0-T09 builds the audit (`scripts/check-http-build.mjs`, fails if a matrix route chunk imports `*/mock/**` data).
- **No function lost:** mock handlers are test aids; keep them only for tests and CI seeds (`uat-like` profile is for automated tests only, D110).
- **Related placeholder routes (map finding F-07, D113):** `core-routes.ts` registers the preview routes `/admin` (`dev.preview-hub-admin`) and `/dashboard` (`dev.preview-hub-user`) although the real routes exist (temporary D20 placeholders). `previewHubRoutes()` and its call are deleted by S0-T05 (FR-X2-0); the two routes have status `retire` in the canonical map.
- **Cards / PRD:** S0-T09, S0-T05; each module card. PRD 40 FR-X2-0, register row 17; 50 DM-28 (delete m27 read models), DM-39.
- **Proof:** AC-X2-2 (no mock data in a visible-browser walk on UAT); S0-T09 report is empty for matrix routes.
- **Do NOT:** do not delete `*/mock/**` that tests import; do not leave a feature that works only on mock; do not add new mock handlers.

### P-02 Two leaderboard endpoints; an always-empty digital-gift endpoint
- **Plain description:** The backend serves the leaderboard from two controllers and the digital-gift list from an endpoint that returns nothing.
- **Where (verified):** `GET /api/leaderboard` (`reports/performance/http/social.controllers.ts:58`) and `GET /api/gamification/leaderboard` (`gamification/gamification.controller.ts:69`); `GET /api/hadiah-digital/items` and `/redemptions` (`shop/shop.controller.ts:34,39`, data always `[]`).
- **Keep (DECIDED D113):** `GET /api/leaderboard` (`reports/performance/http/social.controllers.ts:58`, client `m08 api/performance.ts:104-106`) is the single API. It is fixed to honour `scope=kelas|sekolah` and `period=all|week|month` and to return `{me, podium[3], rows[]}` ranked by syiling (the shape of API-GAME-06).
- **Action:** REMOVE `GET /api/gamification/leaderboard` (`gamification/gamification.controller.ts:69`, client `m14 api/student.ts:80-82`) once nothing calls it (grep `src/modules` first); update API-GAME-06 and API-RPT-13 (section 7). Digital: point the digital page at the shared catalogue (R-02); remove `GET /api/hadiah-digital/items` and `/redemptions` (`shop/shop.controller.ts:34,39`) once the page moves.
- **No function lost:** period filter and own-rank must exist in API-GAME-06 (S7-T06).
- **Cards / PRD:** S7-T06, S7-T05. PRD 60 API-GAME-06, API-RPT-13, API-GAME-08.
- **Proof:** AC-MUR-33-1..3; AC-MUR-38-1.
- **Do NOT:** do not delete an endpoint that a client still calls (grep `src/modules` first).

### P-03 Two front-end clients for the same admin endpoints
- **Plain description:** The Bijak module has its own HTTP client for `GET /api/questions` and `/api/admin/papers`; question-bank and builder code have another.
- **Where (verified):** `m28-bijak-spm/server/http-admin.ts` (bank list, summary, `/api/admin/papers`, `/api/questions/studio/dskp`) versus `m04-question-bank/api/questions.ts:410-435`; and `m28-bijak-spm/admin/builder/server/http.ts:99-101` versus `m28 .../server/http-admin.ts:375` for `GET /api/admin/papers`.
- **Keep (DECIDED D113):** the client inside the owning module. For `GET /api/questions` the owner is `m04-question-bank/api/questions.ts`. For `GET /api/admin/papers` the owner is the builder client `m28-bijak-spm/admin/builder/server/http.ts`.
- **Action:** `m28-bijak-spm/server/http-admin.ts` (bank-wire and paper list) becomes a thin re-export of those two clients, then is deleted once nothing imports it. Part of S2-T03 (bank) and S3-T02 (papers). D113 is the Delivery Lead's written approval (FR-X1-5) for these files only.
- **No function lost:** n/a.
- **Cards / PRD:** none.
- **Proof:** n/a.
- **Do NOT:** do not add a third client; reuse the nearest existing one; when you change an endpoint shape, change both clients.

### P-04 The same number computed several ways
- **Plain description:** Pupils, teachers and answers are counted by different queries per screen, so the numbers differ (pupils 17/16/13, teachers 3/4, answers 122/30/36, accuracy 57.9/73.3/33.3 percent).
- **Where (doc says):** school-admin screens; `m27-school-admin/mock/read-models/*` (verified present).
- **Keep (decided, DM-28, FR-X4-1, XS-1..XS-5):** one named query per measure, used by every screen; no stored display constants.
- **Action:** MERGE; delete the mock read models. If a read-only `EXPLAIN` on UAT shows school-scope answer counts above 300 ms p90, add `practice_answers.school_id` snapshot, not before.
- **No function lost:** every screen keeps its figure, now from the same query.
- **Cards / PRD:** S6-T03 (owner), S10-T02, S10-T07. PRD 40 FR-X4-1, FR-X4-5; 20 section 5.
- **Proof:** AC-XS-1, AC-XS-2, AC-XS-3, AC-XS-4.
- **Do NOT:** do not add a per-screen query for these measures; do not hard-code a figure.

### P-05 Three "On Track" rules for Headcount
- **Plain description:** Docs and code gave three different rules for who is "On Track".
- **Where (doc says):** audit F-03; 20 R1-GUR-3 HC-SPEC (HC-1..HC-6); XS-6.
- **Keep (decided):** one rule: AR >= OTR_k of the latest checkpoint that has an AR. Auto AR = round(correct/answered*100) over `practice_answers` of the subject, all modes.
- **Action:** MERGE. Docs 50 and 60 define no second rule.
- **No function lost:** Manual AR at 1 decimal in `headcount_entry_marks`; class defaults `default_tov`, `default_etr` (DM-49).
- **Cards / PRD:** S10-T02. PRD 20 FR-GUR-3-8/9, AC-GUR-3-13; 50 DM-29, DM-49.
- **Proof:** AC-GUR-3-13, AC-CHAIN-5.
- **Do NOT:** do not write a second "On Track" predicate.

### P-06 `GET /api/weekly-report` always 403
- **Plain description:** The only weekly-report endpoint refuses every role by design; the real teacher report endpoint does not exist.
- **Where (doc says; consistent with R-03):** API-RPT-13 lists `GET /api/weekly-report` (always 403, student/parent screen unchanged); API-GUR-21 `GET /api/guru/weekly-report?classroomId=&week=` is Missing-Build.
- **Keep:** API-GUR-21 for the teacher; the old endpoint is left as is.
- **Action:** BUILD the new endpoint (S6-T01); leave the old one.
- **No function lost:** n/a.
- **Cards / PRD:** S6-T01. PRD 60 API-GUR-21, API-RPT-13.
- **Proof:** AC for R1-GUR-43 weekly report.
- **Do NOT:** do not open the old endpoint to teachers.

### P-07 Two mock-exam engines
- **Plain description:** `/api/spm-mocks` (older) and `/api/bijak/attempts` (Bijak SPM) both run a timed mock exam.
- **Where (verified):** `spm/mocks.controller.ts` (`spm_mock_exams`) versus `bijak/attempts/attempts.controller.ts` (`exam_attempts`); docs 60 API-BIJAK-08 vs API-BIJAK-04/05.
- **Keep (DECIDED D113):** Bijak (writes `practice_answers` with modes `simulasi`, `tracking_a`, `subjektif`) is the single exam engine.
- **Action:** no new writes to `/api/spm-mocks`; `/spm-mock` redirects to `/spm/bijak` (M-10); retire `spm/mocks.controller.ts` and `spm_mock_exams` per M-10.
- **No function lost:** n/a (not offered).
- **Cards / PRD:** S3-T04. PRD 60 API-BIJAK-08; 10 line 102.
- **Proof:** hidden route answers the standard 404 page.
- **Do NOT:** do not extend `/api/spm-mocks`; do not write its rows into reports.

---

## 6. Looks like a duplicate but is on purpose (do not merge)

| What | Why it stays |
|---|---|
| Role mounts of one component set: `/guru/monitoring`, `/admin/monitoring`, school-admin alias; Kirkpatrick at `/admin/kirkpatrick`, `/guru/kirkpatrick`, `/admin-sekolah/kirkpatrick` (`m12 routes/mount.ts:19-37`) | One component, a route prefix prop; each role sees its own scope. |
| `/panduan` and `/pusat-tuisyen/panduan` | V2 has both; same `PanduanPage.vue`. |
| Soalan Berstruktur (`/admin/structured-questions`, `GET /api/structured-questions`) | Verified: it is a read view of the **same** `questions` store (`structured.controller.ts` uses `QuestionsService`), not a second table. |
| `POST /api/guru/questions/import` and admin `POST /api/question-imports` | Same service (`QuestionImportsService`), two role-scoped endpoints. |
| PDF intake (`/api/intake/*`), CSV import, manual entry, teacher paper submit | Four ways in, one destination (draft questions in the one store and the Import & Semakan screen). Not merged; each gets a button or a tab. |
| Hub `SPM` lane cards and group `SPM` items | V2 has both. |
| Studio list and `Senarai Soalan` | V2 has both over one store (M-01). |
| PKSK questions (`/admin/pksk/questions`, tags `pksk_*` on `question_tags`) | A tag-filtered view of questions, not a second bank. |
| `dskp_*` tables | Teacher picking list kept on purpose (DM-15). |
| Teacher `Databank Soalan` (`/guru/databank`) listed for several roles in `user-nav.ts:350,490,537` | One route, per-role menu entries. |

---

---

## 7. Applied fixes

Each row of the original 31-row fix list is now an applied fix: the document that carries it, what the text says now, and which task applied it. Paths are under `docs/prd/r1/` unless stated. "Applied in" names the document and the handoff task (T1 = 10-murid, T2 = 30-admin-pusat, T5 = 50 and 60, T6 = plan). Where a fix is a code change it is carried by the named plan card, because this branch changes documents only.

| # | Target (file, section) | Fix | Applied in |
|---|---|---|---|
| 1 | `01-product-overview.md`, problem table, row "Admin side is duplicated" | The row reads: "Three menu items open three lists of the same questions (`Bank Soalan`, `Bank Soalan (Studio)`, `Bank Soalan SPM`);" instead of "Three lists are all called "Bank Soalan";" | applied in `01-product-overview.md` (Delivery Lead) |
| 2 | `30-admin-pusat.md`, 1.1 Problem, row 1 | "Three lists of one question store are labelled `Bank Soalan` (`menu.ts:95`), `Bank Soalan (Studio)` (`:103`) and `Bank Soalan SPM` (`:116`):" | applied in `30-admin-pusat.md` (T2) |
| 3 | `30-admin-pusat.md`, 3.3 row KS-15 | The queue LIST route `/admin/spm/semakan` redirects to `/admin/studio?status=review` (the value is `review`, never `reviewed`); the review workspace `/admin/spm/semakan/:key` stays and opens from the Studio tile `Menunggu Semakan` and the row action `Semak` (D113) | applied in `30-admin-pusat.md` (T2) |
| 4 | `30-admin-pusat.md`, 3.3 row KS-02 | HIDE: the list redirects to `/admin/spm/databank` only after the Bank page KPI strip is in the Studio list header, the preview is the Studio row action `Pratonton` (also used by the Databank lane), and "Sunting" creating version n+1 is in Studio `Sunting` (D113) | applied in `30-admin-pusat.md` (T2) |
| 5 | `30-admin-pusat.md`, 3.3 row KS-09 | The list and `/admin/spm/kertas/baharu` redirect to Set Builder; `/admin/spm/kertas/:id` becomes `Semak Kertas` (review and `Terbit`, structure read-only), reached from the lane row `Sunting`; `PaperEditorPage` is retired after its functions (running Markah and Soalan budget per Bahagian, `Simpan draf`, `Tulis soalan baharu`, `Lihat di Bijak SPM`, `Sembunyikan`) are in Set Builder (D113) | applied in `30-admin-pusat.md` (T2) |
| 6 | `30-admin-pusat.md`, 3.3, new row after `Import CSV` | `/admin/questions/create` and `/admin/questions/:id/edit` (old flat form): REDIRECT to Studio `/admin/studio/questions/create` and `/admin/studio/questions/:id/sunting` with the notice "Borang soalan lama telah dipindahkan ke Studio. Sila cipta soalan baharu di sini." after the field comparison (D113) | applied in `30-admin-pusat.md` (T2) |
| 7 | `30-admin-pusat.md`, 4.V row Q-04 and R1-ADM-Q-04 "Routes and titles" | Edit route is `/admin/studio/questions/{id}/sunting`; the V2 path `/edit` is an alias redirect (S2-T03) | applied in `30-admin-pusat.md` (T2) |
| 8 | `30-admin-pusat.md`, 4.V row Q-13 | "two list components (`PaperListPage.vue`, `SetBuilderLandingPage.vue`) over one endpoint `GET /api/admin/papers`" | applied in `30-admin-pusat.md` (T2) |
| 9 | `30-admin-pusat.md`, 4.V rows Q-13 and Q-15 and the 3.2 note | "Pembina Kertas is retired; Set Builder is the only builder (D113)" | applied in `30-admin-pusat.md` (T2) |
| 10 | `30-admin-pusat.md`, 1.1 row 12 | The empty route files are `m17/routes/{dashboard,analytics,laporan}.ts`; `laporan-eksekutif.ts` has an S8 header comment and is listed only after it is verified empty | applied in `30-admin-pusat.md` (T2) |
| 11 | `60-api-contract.md`, 6.2 OQ-API-19 | CLOSED: FR-ADM-G7.3, DM-05 and OD-3 agree that `stem_duplicated` is not excluded; the text is shown once and the data is cleaned (DM-40) | applied in `60-api-contract.md` (T5) |
| 12 | `60-api-contract.md`, API-GAME-06 | `GET /api/leaderboard` is the single leaderboard API (D113), fixed to honour `scope` and `period` and to return `{me, podium[3], rows[]}`; `GET /api/gamification/leaderboard` is removed once no client calls it; `/gamification/leaderboard` redirects to `/leaderboard` | applied in `60-api-contract.md` (T5) |
| 13 | `60-api-contract.md`, API-RPT-13 | The Status column adds "single leaderboard API (see API-GAME-06)" | applied in `60-api-contract.md` (T5) |
| 14 | `60-api-contract.md`, API-GAME-08 | `GET /api/hadiah-digital/items` and `GET /api/hadiah-digital/redemptions` are marked "removed once `/cikgu/hadiah` reads the shared `rewards` catalogue (D113)" | applied in `60-api-contract.md` (T5) |
| 15 | `10-murid.md`, R1-MUR-33 Route line | "**Route**: `/leaderboard` (canonical, D113); `/gamification/leaderboard` redirects to it." | applied in `10-murid.md` (T1) |
| 16 | `10-murid.md`, R1-MUR-33 current gap | "one route and one API: `/gamification/leaderboard` and `GET /api/gamification/leaderboard` are removed in favour of `/leaderboard` and `GET /api/leaderboard`" | applied in `10-murid.md` (T1) |
| 17 | `10-murid.md`, R1-MUR-38 Gap | "Gap: `GET /api/hadiah-digital/items` always returns `[]`; read the shared `rewards` catalogue (D113)." | applied in `10-murid.md` (T1) |
| 18 | `10-murid.md`, hidden modules (line 102) | "SPM Mock Exam (`/spm-mock` redirects to `/spm/bijak`, D113)" | applied in `10-murid.md` (T1) |
| 19 | `50-data-model-erd.md`, 4.7a registry sentence | New mode values are `databank`, `kuiz`, `simulasi`, `tracking_a`, `subjektif`, `game`, `structured`, `battle`, `audio_kbat` (`pksk` is already a session mode and becomes an answer mode too). `structured_attempts`, `battle_answers`, `pksk_exam_attempts` and `audio_kbat_attempts` keep session-level data only; their answers are also written to `practice_answers` (D113) | applied in `50-data-model-erd.md` (T5) |
| 20 | `50-data-model-erd.md`, 4.7a registry table | Rows added: Latihan Berstruktur → `structured` (submit of a structured attempt, S5-T11); Battle Arena → `battle` (each answered battle question, S7-T01); Audio KBAT → `audio_kbat` (each answered item, S5-T12) | applied in `50-data-model-erd.md` (T5) |
| 21 | `50-data-model-erd.md`, DM-44 | Appended: "`mode` is a column added by this DM (not in the schema today); the check lists every mode of the registry." | applied in `50-data-model-erd.md` (T5) |
| 22 | `50-data-model-erd.md`, 3.7 line for `ENT-SyilingReward` and `ENT-RewardClaim` | "`rewards` is the one catalogue. `syiling_rewards` and `reward_claims` are migrated into `rewards`, `reward_redemptions` and `reward_settings` and retired (D113)." | applied in `50-data-model-erd.md` (T5) |
| 23 | `50-data-model-erd.md`, DM-77 in 4.9 | DM-77 in 50 section 4.9: migrate `syiling_rewards` cost and `reward_claims` into `rewards`, `reward_redemptions` and `reward_settings`; switch Kawalan Reward to `rewards`; retire the two tables later (S7-T05) | applied in `50-data-model-erd.md` (T5) |
| 24 | `50-data-model-erd.md`, OD-13 | Appended: "Recorded as U-OP-18 (read-only dry-run by the UAT developer; the admin merges duplicates in the regroup work-list)." | applied in `50-data-model-erd.md` (T5) |
| 25 | `30-admin-pusat.md`, section 5 UAT data operations table | Row U-OP-18: duplicate-stimulus report and merge: dry-run `group-integrity.sql` (read-only), then the admin merges through the regroup work-list; DEV runs the report, ADM merges; needs U-OP-05 and QE-08 built; done when a re-run shows 0 duplicates (OD-13) | applied in `30-admin-pusat.md` (T2) |
| 26 | `docs/plan/r1-development-plan.md`, S2-T03 Approach | Added: `/admin/spm/kertas/baharu` redirects to Set Builder create; `/admin/questions/create` and `/admin/questions/:id/edit` redirect to Studio after a field comparison; `/spm-mock` redirects to `/spm/bijak`; `/gamification/leaderboard` redirects to `/leaderboard`; `m28-bijak-spm/server/http-admin.ts` becomes a re-export of the m04 and builder clients | applied in `docs/plan/r1-development-plan.md` (T6) |
| 27 | `docs/plan/r1-development-plan.md`, S3-T02 Approach | `/admin/spm/kertas/:id` becomes `Semak Kertas` (review and Terbit); move into Set Builder first: running budget per Bahagian, `Simpan draf`, `Tulis soalan baharu`, `Lihat di Bijak SPM`, `Sembunyikan`; then retire `PaperEditorPage` | applied in `docs/plan/r1-development-plan.md` (T6) |
| 28 | `docs/plan/r1-development-plan.md`, S7-T06 and S7-T05 | S7-T06: "`/leaderboard` is canonical, one API `GET /api/leaderboard`"; S7-T05: "switch Kawalan Reward to `rewards`, migrate and retire `syiling_rewards`, `reward_claims`" | applied in `docs/plan/r1-development-plan.md` (T6) |
| 29 | `docs/plan/r1-development-plan.md`, S5-T15 Approach | Added "and Latihan Berstruktur, Battle, PKSK and Audio KBAT (modes `structured`, `battle`, `pksk`, `audio_kbat`)" after "expose the port to Bijak, Subjektif, Set Soalan and the games" | applied in `docs/plan/r1-development-plan.md` (T6) |
| 30 | `docs/plan/r1-development-plan.md`, S0-T07 Approach | Added: "Remove the Admin Pusat items from `user-nav.ts` and retire `admin-nav.ts` `ADMIN_NAV` when unused (D113)." | applied in `docs/plan/r1-development-plan.md` (T6) |
| 31 | `src/shells/pentadbiran/menu.ts` (code), file header comment | "9 groups and 106 items" becomes "9 groups and 103 items" (or the real count after S0-T07) | carried by card S0-T07 (a code comment; this branch changes documents only) |

Documents that are not 10, 30, 50, 60 or the plan and that this register touches: this file (47) and [40-cross-cutting.md](40-cross-cutting.md) (X8 glossary entry "Duplicate (six meanings)", AC-CHAIN lists "AC-CHAIN-1 to AC-CHAIN-10").

---

## 8. Decisions taken by D113 (the former open points)

D113 (Delivery Lead, by principle: keep the V2-matching or most complete copy, merge the rest, never lose a function). No item is open.

| # | Former open point | DECIDED (D113) | Entry |
|---|---|---|---|
| 1 | Review workspace `/admin/spm/semakan/:key` | Stays as a screen, opened from Studio `Menunggu Semakan` tile / row action `Semak`; only the list route redirects to `/admin/studio?status=review` | M-04 |
| 2 | `/admin/spm/kertas/baharu`, `PaperEditorPage` | `baharu` redirects to Set Builder create; `/admin/spm/kertas/:id` becomes `Semak Kertas`; editor retired after 5 listed functions move into Set Builder | M-05 |
| 3 | Old `/admin/questions/create`, `/:id/edit` | Redirect to Studio create / `sunting` after field comparison; missing fields (Arabic/Jawi keyboard, single question image, legacy `Jenis Soalan` values) added first | M-06 |
| 4 | Bank page KPI strip and preview | KPI strip into the Studio list header; preview = row action `Pratonton` (also used by Databank lane); version n+1 in Studio `Sunting` | M-01 |
| 5 | `/spm-mock`, `spm_mock_exams` | Redirect to `/spm/bijak`; no new writes; readable only if UAT has rows, else retired | M-10, P-07 |
| 6 | Admin items in old nav files | Removed; `pentadbiran/menu.ts` is the only admin menu | M-11 |
| 7 | Leaderboard URL and API | `/leaderboard` and `GET /api/leaderboard` canonical (fixed for scope/period); `/gamification/leaderboard` and `GET /api/gamification/leaderboard` removed once unused | R-01, P-02 |
| 8 | Answer modes for other flows | Add `structured`, `battle`, `pksk`, `audio_kbat`; each flow also writes `practice_answers`; `practice_answers.mode` is a DM addition | S-02 |
| 9 | Reward catalogues | Keep `rewards` + `reward_redemptions`; Kawalan Reward switched; `syiling_rewards` and `reward_claims` migrated and retired | S-05 |
| 10 | Two front-end clients | Keep `m04-question-bank/api/questions.ts` and `m28-bijak-spm/admin/builder/server/http.ts`; `m28-bijak-spm/server/http-admin.ts` becomes a re-export then is deleted | P-03 |
| 11 | Duplicate stimuli on UAT | U-OP-18: read-only `group-integrity.sql` dry-run by the UAT developer; admin merges through the regroup work-list | C-03 |

---

## 9. Glossary of internal codes

**Menu ids (`src/shells/pentadbiran/menu.ts`)**

| Code | Meaning |
|---|---|
| PP-xx | Group `Papan Pemuka`: PP-01 `Dashboard`, PP-02 `Laporan Eksekutif` |
| PM-xx | Group `Pemantauan`: PM-01 `Langsung` (V2 `Command Center`), PM-02 `Aktiviti Harian`, PM-03 `Monitoring`, PM-04 `Analitik`, PM-05..11 Kirkpatrick screens, PM-12..28 hidden reports |
| BS-01 | `Bank Soalan` -> `/admin/questions` (becomes `Senarai Soalan`) |
| BS-02 | `Import & Semakan` -> `/admin/spm/soalan/ekstrak` |
| BS-03 | `Sumber Kertas` (source papers registry) |
| BS-04 | `Kualiti Soalan` -> `/admin/questions/quality` |
| BS-05 | `Laporan Soalan` -> `/admin/question-reports` |
| BS-06 | `Soalan PKSK` -> `/admin/pksk/questions` |
| BS-07 | `Audio KBAT` -> `/admin/audio-kbat` |
| BS-08 | `Bank Soalan (Studio)` -> `/admin/studio` |
| KS-01 | `SPM` hub -> `/admin/spm` |
| KS-02 | `Bank Soalan SPM` -> `/admin/spm/soalan` (BankPage) |
| KS-03..06 | Hidden lane placeholders: `Latih Tubi`, `Tracking A`, `Subjektif`, `Bijak SPM (Simulasi)` |
| KS-07 | `Kertas Subjektif` |
| KS-08 | `Kontrak Simulasi` -> `/admin/spm/kontrak` |
| KS-09 | `Pembina Kertas` -> `/admin/spm/kertas` |
| KS-10 / 11 / 12 | `Tanda Karangan` (AI), `Ramalan SPM`, `Set Soalan` (merged into Tracking A) |
| KS-13 | `Muat Naik Kertas` -> `/admin/spm/soalan/muat-naik` |
| KS-14 | `Senarai Ekstrak` -> `/admin/spm/soalan/ekstrak` |
| KS-15 | `Baris Gilir Semakan` -> `/admin/spm/semakan` |
| KS-16 | `Tulis Soalan Manual` -> `/admin/spm/soalan/manual` |
| KS-17 | `Set Builder` -> `/admin/studio/sets` |
| KK-xx | Group `Kurikulum & Kandungan` (KK-01 `Kurikulum`, KK-02 `Subjek`, KK-03 `Bab` removed, KK-04 `Tahap Pendidikan`, KK-05 `Banner`, KK-06 `Artikel`, KK-07 `Nota`, KK-08 `Video`) |
| PS-xx | Group `Pengguna & Sekolah` (PS-01 `Pengguna`, PS-03 `Kelas Sekolah`, PS-05 `Import Pengguna`) |
| PG-xx | Group `Penglibatan` (gamification, battle, marketplace, tiket) |
| KW-xx | Group `Kewangan` (KW-05 `Langganan Sekolah`, KW-06 `Akses PKSK`) |
| SY-xx | Group `Sistem` (SY-01 `Tetapan`, SY-02 `Kawalan Ciri`, SY-05 `Upload Screenshot`) |

**Screen and requirement codes (PRD 30)**

| Code | Meaning |
|---|---|
| Q-01..Q-24 | Question-pipeline screens (Q-03 Studio list, Q-04 wizard, Q-07 Import & Semakan, Q-13 Set Builder, Q-15 Semak & Terbit, Q-16 Kontrak, Q-17 Tracking A, Q-18 Kertas Subjektif, Q-20 Senarai Soalan, Q-21 Kualiti, Q-22 Laporan, Q-23 Soalan Berstruktur, Q-24 Quick Edit) |
| C-01..C-05 | Curriculum screens (C-05 bulk `Tetapkan Bab`) |
| N-xx, U-xx, M-xx, P2-xx | Content/settings, users, monitoring, rest-of-matrix admin screens (in 30; not the same as the M-xx entries of this register) |
| QE-01..QE-08 | Question-entry standard (QE-01 stimulus-group rule, QE-08 regroup work-list) |
| G5/G6/G7 | DSKP guidance flows; G7 = stimulus-less/duplicated questions (FR-ADM-G7.1..G7.6) |
| H0 | Rules for matrix-wide admin screens (FR-ADM-H0.1..4: no placeholder in the menu) |
| FD-xx, DV-xx | Fidelity deviation / deviation record (FD-MUR-33 = one catalogue, two entry points) |
| OQ-xx / OD-xx | Open question / open decision (OD-3 stem_duplicated; OD-5 keep `dskp_*`; OD-13 duplicate-stimulus report) |
| E-xx | Evidence item |
| U-OP-xx | UAT data operation (U-OP-05 detect stimulus-less; U-OP-06 trim duplicated stems; U-OP-17 regroup) |
| E2E F1..F9 | Findings of the functional E2E (F3 two review queues disagree; F4 two builders) |
| GAP 5.4 | Section of the gap analysis that lists the duplicated question menu |
| FR-X1-4a..f | Stimulus rule: never a question, group first, extraction keeps groups, display once, drills serve groups, regroup legacy |
| FR-X1-5 | Improve, not rebuild |
| FR-X4-5 | One answer store |
| XS-1..XS-8 | Cross-screen numbers (pupils, teachers, answers, accuracy, On Track); XS-8 = answer source |
| AC-CHAIN-1..10 | End-to-end data chains proved on UAT (defined in [40-cross-cutting.md](40-cross-cutting.md) §X9) |

**Data-model codes (PRD 50)**

| Code | Meaning |
|---|---|
| F1..F11 | Findings of the data audit (F5 = four curriculum structures; F2 = groups need >= 2 members) |
| DM-01..DM-49 | Planned schema/data changes (DM-05 stimulus flags, DM-06 regroup, DM-15 keep `dskp_*`, DM-16 switch reader off `legacy_topics`, DM-23 `papers.surface`, DM-24 Tracking A unique, DM-40 trim duplicate stem, DM-43 teacher kertas, DM-44 single answer store, DM-45 batch to paper, DM-48 reward settings) |
| INV-xx | Invariants (INV-08 a stimulus is in exactly one group) |
| ENT-xx | Entity dictionary rows |
| D-A1..D-A15 | Audit decisions (D-A1 single answer store; D-A2 batch to paper; D-A6 TP vs difficulty; D-A11 coin rate; D-A12 first name only) |
| F-01..F-20 | Audit findings (F-02 reports read one store; F-03 three On Track rules; F-12 two coin rates) |

**API codes (PRD 60)**

| Code | Meaning |
|---|---|
| API-Q-xx | Question APIs (Q-01 list, Q-12 servability flags, Q-13 regroup list, Q-24 regroup, Q-25 batch to paper) |
| API-BIJAK-xx | Bijak SPM / exam (BIJAK-08 mocks) |
| API-GAME-xx | Gamification, shop, games (GAME-06 leaderboard, GAME-08 digital gifts, boxes, draws) |
| API-RPT-xx | Reports (RPT-13 rankings, leaderboard, weekly report) |
| API-GUR-xx | Teacher (GUR-21 weekly report) |
| API-PRAC-xx | Practice (PRAC-01 answer modes) |
| API-ADM-xx | Admin (ADM-01 users) |

**Plan codes (`docs/plan/r1-development-plan.md`)**

| Code | Meaning |
|---|---|
| S0..S10 | Sectors: S0 foundations/menu, S1 question model, S2 admin question screens, S3 SPM/Bijak, S4 data ops/curriculum, S5 pupil learning, S6 teacher/school admin, S7 gamification/shop/support, S8 shared components, S9 acceptance, S10 performance |
| S0-T07 | Target admin menu |
| S2-T03 | One bank, one queue, aliases |
| S3-T02 | One Set Builder |
| S1-T07 | Servability indicator and stimulus flags |
| S4-T04 | Regroup data operations and duplicate-stem cleanup |
| S5-T15 | Single answer store |
| S7-T05 / S7-T06 | Kedai Hadiah (+Digital) / Papan Pendahulu |
| D-numbers | D72/D96 Tingkatan only; D73 AI hidden; D90 stimulus is not a question; D93 group first; D100 everything ticked must work; D101 T1-T5 served; D104 Subjektif in 1.0; D105 drills serve groups; D107 admin menu follows V2 with merged duplicates; D108 principle rulings; D110 UAT is the acceptance site |

**Code-only terms the docs do not explain**

| Term | Meaning |
|---|---|
| `DuplicateLink` / `POST /api/intake/items/:id/duplicate` | Near-duplicate question detection inside the intake pipeline (a feature, not the duplication in this register; it is the sixth meaning of "duplicate" in the glossary of 40-cross-cutting X8) |
| `PrototypeUnavailablePage` | The "Belum tersedia dalam prototaip" placeholder page (retired by S0-T05) |
| `BARE_IN_PORTAL`, `adminShellFor` | Router helpers that put admin screens inside the Pentadbiran frame (`src/app/router/layouts.ts`) |

---

## 10. How CI enforces this register

The decisions above are machine-checked. The source of truth is [`docs/plan/r1-canonical-map.json`](../../plan/r1-canonical-map.json). The rule in one line: **one function = one screen, one route, one menu entry, one table or model, one API** (see also "No duplicates (enforced by CI)" in `docs/plan/R1-START-HERE.md`).

**The map.** `r1-canonical-map.json` has these parts:
- `_meta`: purpose, statuses, the approval rule and the sector source (`.github/CODEOWNERS`, last match wins).
- `findings`: the cross-cutting duplicates in plain words (F-01 two admin menus, F-02 admin copies in the user nav, F-03 leaderboard, F-04 reward catalogues, F-05 second mock-exam product, F-06 answer tables, and the others), each with the register entry and the D113 decision.
- `routes`, `menus`, `models`, `apis`: every item found in the code, with `key`, `path` or `name`, `file`, owning `sector`, `approved_by_card` and a `status`: `canonical`, `redirect-to:<path>` or `retire` for routes, menus and APIs; `canonical`, `legacy-retire` or `parallel-of:<model>` for models. Examples: `/gamification/leaderboard` is `redirect-to:/leaderboard`; `syiling_rewards` and `reward_claims` are `legacy-retire`; the answer tables other than `practice_answers` are `parallel-of:PracticeAnswer`.
- `concepts` (17 business concepts such as question, question editor, review queue, stimulus group, question set, paper, paper builder, Bijak paper, mock exam, curriculum chapter, DSKP node, answer store, leaderboard, reward catalogue, ticket, headcount, class): each lists the canonical `models`, `route`, `screen`, `api_prefixes`, `keywords` and `owner_sector`. A new model whose name contains a concept keyword, or a new endpoint under a concept's `api_prefixes`, is flagged.

**Commands.**

| Command | What it does |
|---|---|
| `node scripts/r1-canonical-map.mjs --check` | CI. Fails (exit 1) when the code has a route, menu entry, model or API that is not in the map. |
| `node scripts/r1-canonical-map.mjs --write` | Regenerates the code-derived parts (adds new items, drops items that left the code) and keeps the hand-set fields (status, note, `api_id`, `approved_by_card`, concepts, register). Commit the map with the code change. |
| `node scripts/r1-canonical-map.mjs --self-test` | Self-test of the extractors (12 checks). |
| `node scripts/r1-scope-guard.mjs --base <ref> --head <ref>` | CI. Checks a pull request diff (the PR body comes from the environment or `--body-file`). Exit 1 on any FAIL; a WARN does not fail. |
| `node scripts/r1-scope-guard.mjs --self-test` | Self-test of the guard (55 checks). |

**Where it runs.** `.github/workflows/r1-scope-guard.yml`, job `scope-guard`, on pull requests into `feature/v3-bijak-r1` that change anything outside `docs/**` (a documents-only pull request is skipped). Two steps: the scope guard, then `r1-canonical-map --check`.

**Scope guard rules.**

| Rule | Result | What triggers it |
|---|---|---|
| `NO_CARD`, `UNKNOWN_CARD`, `NO_TYPE` | FAIL | the PR names no card ID (`S<n>-T<nn>`), a card that is not in `docs/plan/r1-development-plan.md`, or a card with no `Type:` |
| `NEW_PAGE`, `NEW_ROUTE_FILE`, `NEW_CONTROLLER`, `NEW_MIGRATION`, `NEW_MODEL` | FAIL | a Fix, Complete, Keep or Verify card adds a Vue page, route file, NestJS controller, migration folder or Prisma model and the PR body names no `DM-` or `API-` ID |
| `PRODUCT_CODE_CHANGED` | FAIL | a Keep, Verify or Ops card changes `src/`, `apps/` or `packages/` |
| `DUP_ROUTE` | FAIL | a new front-end route has the same path and name as an existing one in another file, differs only by suffix, prefix or plural, or reuses the component of an existing route |
| `DUP_MENU` | FAIL | a new menu entry has the same label (case and spacing ignored) as an existing entry for the same role |
| `DUP_MODEL`, `CONCEPT_MODEL` | FAIL | a new Prisma model has a similar name to an existing one (same stem or a small edit distance), or is a new model for a listed concept |
| `DUP_API`, `CONCEPT_API` | FAIL | a new endpoint repeats an existing method and path pattern in another file, or is a new endpoint under a concept's `api_prefixes` |
| `RETIRED_REF` | FAIL | a new reference to a retired model, route or API (status `legacy-retire` or `retire`) |
| `REDIRECT_REF` | WARN | a new link to a route whose status is `redirect-to:<path>`; use the canonical route |
| `NO_STARTS_FROM_TOUCHED`, `BIG_SHRINK`, `BUILD_OUTSIDE_DIRS`, `DUP_CHECK_ERROR` | WARN | a Fix or Complete card touches none of its "Starts from" paths; a file loses more than 60 % of its lines (files of 10 lines or more); a Build card adds files outside the directories it names; the duplicate check itself could not run |

**The only way through** a duplicate FAIL is an explicit approval in the same pull request: the PR body names a `DM-` or `API-` ID **and** the item's entry in the map carries `"approved_by_card": "<this PR's card id>"`. The approval is a decision of the sector owner and the Delivery Lead; it is not a way round the check. When no approval is justified, use the existing item named in the map and register entry instead of building another copy.
