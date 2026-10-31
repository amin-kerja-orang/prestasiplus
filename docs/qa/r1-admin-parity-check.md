# R1 admin UX parity check (H-A19, D79; refreshed by H-A22 against base 823d8dfb)

- **Question:** does the Portal Pentadbiran for R1 behave like the V2 Panel and admin (`admin.prestasiplus.cloud` and `.cloud /admin`) so that admins relearn nothing (D79d)? Read-only code check; no screen was run.
- **V2 reference:** `docs/discovery/v2-parity/admin.md` (rows A01 to A29), `docs/discovery/BIJAK-SPM-cloud.md` sections 3.8 to 3.10, 4.2, 4.3 (verbatim BM labels and flashes), and `docs/requirements/v3-bijak-spm-scope.md` R1-21 (P1 to P7). Where the V2 label is not recorded in the repo the row says "unconfirmed".
- **V3 sources read (refresh, 2026-10-31):** base `feature/v3-bijak-r1` at 823d8dfb (BASE-19); team A branches `r1/t29-servability` (72a4048a), `t30-servability-reads` (28a695ea), `t33-leaf-tags` (276a6622), `t34-builder-review` (e363fe51), `t42-reports-intake-acs` (d1210e96), team C branches `r1/t13-studio-groups` (114173c9), `t13b-studio-list` (5267bce0), `f08-builder-ui` (9aa080d5), `hc-intake-parity` (eaef3360), `hc-kandungan-hub` (b2424eb0), `hc-kontrak-parity` (08474528), `hc4-report-arkib` (b458c8f3). Routes and strings compared with `git grep` / `git show`; no checkout.
- **Classes:** parity | label differs (both labels given) | step / click count differs (V2 n, V3 n) | missing | unconfirmed | not applicable. API and FE are classified separately. A branch tag in square brackets, for example `[t13b]`, means the code is on that branch only and not in base.
- **Date:** 2026-10-31. Branch `r1/ha22-parity-docs`. Docs only; no real names.

## 1. Summary

66 rows in 7 areas. Counts now, with the H-A19 figures (base BASE-8) in brackets.

| Class | API rows | FE rows |
|---|---|---|
| parity | 37 (41) | 43 (8) |
| label differs | 1 (3) | 7 (22) |
| step / click count differs | 0 (0) | 4 (7) |
| missing | 20 (12) | 2 (17) |
| unconfirmed | 1 (3) | 4 (6) |
| not applicable (V3 change or out of R1) | 7 (7) | 6 (6) |
| **total** | **66** | **66** |

- Merged into base since H-A19: T32 (stimulus API) and T35 (Arkib on a report), plus T07, T08, T28, H-A2, R1E2E-01, T25, H-A7, T06 and T05 minors (BASE-9 to BASE-19), which touch no other admin row. Every other unit that was cited is still on its branch, so no API row could be re-cited to base.
- API "missing" rises from 12 to 20 because of a change of rule, not because of new gaps: seven rows that were counted parity, label or unconfirmed while their code sat on an unmerged branch (S14, H1, H2, H3, H4, R4, R10) now count as missing in base with the branch named; P5 (`pinned`) is the one new gap.
- FE parity that exists **only on an unmerged branch**: 39 of the 43 FE parity rows (S1, S2, S4, S5, S6, S7, S8, S9, S10, S12, S13, S14, I3, I6, I7, K1, K4, K6, K7, K9, K10, P3, P4, P5, P6, R1, R2, R3, R4, R6, R7, R8, R9, R12, L3, H1, H3, H4, H5). API rule used here: the class reflects base only, so a route that exists only on an unmerged team A branch counts as `missing` with the branch named. Those rows: 16 (S3, S5, S9, S13, S14, P5, R3, R4, R5, R10, R12, L4, H1, H2, H3, H4).
- The three FE surfaces that had no code at H-A19 now have branches: Kandungan SPM hub and lanes (`hc-kandungan-hub`, wip), Studio list and status buttons (`t13b-studio-list`), and the Studio menu entry (f08). Nothing of them is in base.
- T34 follow-up (structured blockers and a `canOverride` flag): **not pushed**; `r1/t34-builder-review` head is e363fe51 (B2 findings, D93 group minimum). T48: **no branch pushed**. T44 (`Boleh tanda auto`): not pushed.

### Rows moved since H-A19

| Row | API before / now | FE before / now |
|---|---|---|
| S1 | same | missing / parity |
| S2 | same | label / parity |
| S4 | same | unconfirmed / parity |
| S5 | same | missing / parity |
| S6 | same | missing / parity |
| S9 | same | missing / parity |
| S10 | same | label / parity |
| S12 | same | step / parity |
| S13 | same | missing / parity |
| S14 | unconfirmed / missing | missing / parity |
| I3 | same | label / parity |
| I6 | same | step / parity |
| I7 | same | missing / parity |
| K1 | same | label / parity |
| K4 | same | label / parity |
| K6 | same | label / parity |
| K7 | same | label / parity |
| K9 | same | missing / parity |
| K10 | same | label / parity |
| P4 | same | label / parity |
| P5 | parity / missing | label / parity |
| R1 | same | label / parity |
| R2 | same | label / parity |
| R3 | same | label / parity |
| R4 | parity / missing | missing / parity |
| R5 | same | missing / label |
| R6 | same | label / parity |
| R7 | same | label / parity |
| R8 | same | step / parity |
| R10 | parity / missing | same |
| R12 | same | label / parity |
| L2 | same | unconfirmed / parity |
| L3 | same | missing / parity |
| H1 | unconfirmed / missing | missing / parity |
| H2 | label / missing | missing / label |
| H3 | parity / missing | missing / parity |
| H4 | label / missing | missing / parity |
| H5 | same | label / parity |

Rows whose text changed without a class change: S3, S7, S11, K2, K8, L4, plus the API notes of S5 and S13, plus the reading of R2 and R3 (labels now V2; rule, count and body edits are left to the blueprint and D90 by design, UX-43).

### Decisions applied (H-A22, 2026-10-31)

- Label rows: the V2 wording wins (D79). Team C changes a `label differs` string to the V2 text quoted in its row, except where the row cites approved copy: D94 (1) approved the proposed BM copy, and D92 (3) keeps the duplicate-Kontrak sentence "Kontrak untuk subjek dan kertas ini sudah wujud. Cipta versi baharu." (rows K3 and the reason-copy rows).
- D-references checked: D90 (shared stimulus), D92 (3), D94 (1), D96 and D76 are cited as defined in `docs/TRACKER.md`. D93 has two parts (the 2-member group rule, and Cuba Lagi earning per attempt); only the first concerns admin screens.
- Student-side rows are in `docs/qa/r1-student-parity-check.md`.

## 2. Team A: API gaps (backend)

### 2.1 Still open (no code in base, none on a pushed branch unless named)

| Row | Gap | Where it stands |
|---|---|---|
| S3 | Studio list filters Tahun, Negeri, Kertas, Jenis | No such filter in base or on any branch. |
| B3 | Filter-based "Luluskan Hasil Tapisan" / "Arkib Semua" | bulk-action takes ids only (limit 200). t33 changes bulk approve to run the approve gate, not the mechanism. |
| K5 | "Boleh tanda auto" field on the blueprint | No autoMarkable / languageMode in the write schema; T44 (A3 dev-2) not pushed. |
| P5 | `pinned` per placed question in the builder answer (chip "Disematkan") | Not in the t34 contract; f08 asks for it (UX-41). New since H-A19. |
| R1 | Paper cover code editable | PUT /api/admin/papers/:id has no cover code. |
| R2 | Edit of answering rule and count of a Bahagian | Set by the blueprint; V2 edits both. Design UX-43 keeps it that way (no user decision found). |
| R3 | Edit of a passage body and caption | Only the group title is editable (D90 shared stimulus). |
| R5 | Create a blank extra question or an admin-made Bahagian in a paper | Only placing a bank question exists (t34). |
| R10 | Structured blockers and a `canOverride` flag on publish | T34 follow-up not pushed; f08 falls back to a text heuristic. |
| R12 | Subject and search filters on the paper list | GET /api/admin/papers has a status filter only. |
| L4 | Paper stored on a Bijak report | t42 (d1210e96) adds attemptId / paperId; not merged. |

### 2.2 Built on a team A branch, waiting for merge

| Row | Route / contract | Branch (head) | State |
|---|---|---|---|
| S5, S9, S14 | POST /api/questions/:id/status, GET /:id/gate-check, DSKP gate text | t33 (276a6622) | not in base |
| S13, H1, H3, H4 | GET /api/admin/servability/overview, /questions/:id, /questions/batch, /lanes/databank, /lanes/bijak-spm | t30 (28a695ea) | not in base |
| H2, B5 | Servability reasons from one BM table; parity spec | t29 (72a4048a) | not in base (t34 contains it) |
| P5, R3, R4, R5, R10 | review rows with per-row servability, PUT groups/:groupId {label}, PUT {reference}, placements, audited Terbit override | t34 (e363fe51) | not in base |
| L4 | attemptId / paperId on a report, stored paper | t42 (d1210e96) | not in base |

Merged since H-A19 and now cited to base: S7 (T32 stimuli and groups), L3 (T35 `PATCH :id {archive:true}`, BASE-18).

Also unconfirmed on the API side: P4.

## 3. Team C: FE gaps (frontend)

### 3.1 Still open

| Row | Class | V2 | V3 FE |
|---|---|---|---|
| S3 | label differs | Filters Subjek, Status, Tahun, Negeri, Kertas, Jenis, each "Semua ...", buttons Tapis / Set Semula (A01, R1-21.5) | [t13b] filters "Semua subjek" and "Semua status" with Tapis / Set Semula; Tahun, Negeri, Kertas, Jenis absent (the API has none). The legacy list keeps its seven filters. - API gap behind the missing filters. D96 (Darjah hidden) is not a difference. |
| B3 | missing | "Luluskan Hasil Tapisan" (needs a filter; confirm "Luluskan SEMUA soalan hasil tapisan ini? Ia akan kelihatan kepada pelajar."; guard "Sila pilih sekurang-kurangnya satu  | Neither string exists in any tree. V3 has selection-based bulk options Luluskan / Terbitkan / Tolak / Arkibkan / Padam (question-list.ts BULK_OPTIONS) - Different mechanism (select rows vs act on the filter) and different labels ("Arkibkan" vs "Arkib Semua"). |
| I1 | label differs | Menu "Import & Semakan" opens the batch list with tabs | Menu BS-02 "Import & Semakan" points to /admin/questions/import (CSV import). The batch list is "Senarai Ekstrak" (KS-14, /admin/spm/soalan/ekstrak). - Same menu word, different destination. |
| K2 | step / click count differs | Create: "Baharu" > dialog "Kontrak Baharu" with Subjek, Kertas, Sumber, Kod Kertas, Tempoh, Jumlah Markah, Boleh tanda auto, Nota; "Batal" / "Cipta" | [hc-kontrak] button "Baharu", dialog "Kontrak Baharu" with Subjek, Kertas and a Sumber select; Kod Kertas, Tempoh, Jumlah Markah, Nota are set in the editor afterwards, then "Simpan". - V2 asks all fields in one dialog (Baharu, fill, Cipta). V3 still has dialog then editor: one extra screen. Cipta button wording: unconfirmed. |
| K3 | label differs | Duplicate guard "Kontrak untuk subjek/kertas ini sudah wujud." | "Kontrak untuk subjek dan kertas ini sudah wujud." with "Buka kontrak" - D92(3) records the V3 wording (adds "Cipta versi baharu."). |
| K5 | missing | "Boleh tanda auto" checkbox | not present - T44 (A3 dev-2) covers it. |
| K8 | label differs | Delete: "Padam kontrak" with confirm "Padam kontrak ini?" + long body about SEMUA kertas | [hc-kontrak] row action "Padam"; confirm title "Padam kontrak ini?" and body "... Semua Bahagian kontrak turut dipadam. Ini menjejaskan pintu terbitan untuk SEMUA kertas subjek/kertas ini ..."; the delete is blocked while Terbit papers depend on it (V2 warns only). - Title and SEMUA text parity; the block is a V3 rule. |
| P1 | step / click count differs | Create blank set: "Cipta Set Baharu" / "Mula kosong", title field "Tajuk set kosong", optional subject; flash "Set komposit dicipta. Seret soalan ke dalam Bahagian untuk  | f08 landing: "Mula kosong", "Tajuk set kosong", flash identical; subject AND kertas are required - V2 title + optional subject; V3 also needs kertas (blueprint, D83 D-6). "Cipta Set Baharu" string absent (admin.md uses "Mula kosong"). |
| P2 | step / click count differs | "Jana set" / "Ambil soalan secara rawak", fields title, subject, count, Tahun, Negeri; aside "Kolam soalan" "{n} soalan tersedia", "Anda meminta {k} daripadanya."; flash  | f08 copy: all five strings identical; filters Tahun/Negeri absent; count comes from the contract - No Tahun / Negeri filter (API has none either). V2 count is free 1-100; V3 follows the contract. |
| P7 | label differs | Contract panel "Kontrak Simulasi" with "Sunting kontrak"; warning "Set ini belum memenuhi kontrak penuh (K2 subjektif tiada)."; "Tiada kontrak untuk subjek/kertas ini." | f08: "Kontrak Simulasi", "Sunting kontrak", "Tiada kontrak ..." identical; warning replaced by "Blueprint perlu semakan" and blockers "{n} masalah menghalang penerbitan." - K2 subjektif is KIV. |
| R5 | label differs | "Soalan Tambahan": "Tambah bahagian", "Tambah soalan" (Nombor soalan, Jenis jawapan, Markah; "Tambah & sunting"), "Padam soalan" with confirm; errors "Nombor soalan {x} s | [f08] PaperQuestionOps: "Tambah soalan" and "Padam soalan" with the V2 confirm text, through t34 placements; no "Soalan Tambahan" heading, no "Tambah bahagian", no Nombor soalan / Jenis jawapan / Markah form. - V2 creates a blank question inside the paper; V3 places a bank question. |
| R10 | step / click count differs | Override tick "Terbitkan walaupun tidak memenuhi kontrak blueprint" (Panel text: "...kontrak Simulasi"), audited | [f08] tick text identical; offer reads `overridable` / `canOverride` when present and otherwise a text heuristic (e1546909); adds a reason field (>= 5 characters, UX-46). - Team A: structured blockers + canOverride. |
| H2 | label differs | Attention labels "tidak boleh ditanda", "set tidak lengkap", "tiada skema — tidak disajikan", "tiada kunci jawapan" | [hc-kandungan-hub] attention text uses the servability sentences (D94 copy) with the word "perlu perhatian"; V2 phrases such as "tidak boleh ditanda" are not used. - Wording differs by design (D94 approved the reason copy). |

### 3.2 Built on a team C branch, waiting for merge into base

| Branch (head) | Rows |
|---|---|
| t13b-studio-list (5267bce0) | S1, S2, S4, S5, S6, S9, S10, S12, S13, S14 (needs t33 and t30 routes to work against the real API) |
| t13-studio-groups (114173c9) | S7, S8 (editor steps), contained in t13b |
| f08-builder-ui (9aa080d5) | P4, P5, P7, R1 to R8, R10, R12, H5, Studio and Kontrak Simulasi menu items (KS-08, BS-08) |
| hc-intake-parity (eaef3360) | I3, I6, I7 |
| hc-kontrak-parity (08474528, wip: tsc and eslint pending) | K1, K4, K6, K7, K9, K10 |
| hc-kandungan-hub (b2424eb0, wip: one lane test pending) | H1, H3, H4 |
| hc4-report-arkib (b458c8f3) | L3 "Arkib" action |

Also unconfirmed on the FE side: B4, B5, L1, L4.

## 4. Full matrix

### 1 Studio (question browser, create, status flow)

| Row | V2 (label / steps) | V3 API | API | V3 FE | FE | Note |
|---|---|---|---|---|---|---|
| S1 | List "Studio", subtitle "Bank soalan kanonikal - cipta, semak, terbit", at /admin/studio (admin.md A01) | GET /api/questions, /questions/summary (base 823d8dfb) | parity | [branch t13b 5267bce0, menu on f08] `/admin/studio`, header "Studio" with subtitle "Bank soalan kanonikal - cipta, semak, terbit"; menu item BS-08 "Bank Soalan (Studio)" (f08, UX-47). Base still has only the legacy list "Pengurusan Soalan". | parity | Parity on branches; not in base. |
| S2 | Status tiles Draft, Reviewed, Approved, Archived with counts (A01) | GET /api/questions/summary (base) | parity | [t13b] four tiles Draft, Reviewed, Approved, Archived with counts that set the Status filter. | parity | V2 words used (`lib/studio/status.ts`). |
| S3 | Filters Subjek, Status, Tahun, Negeri, Kertas, Jenis, each "Semua ...", buttons Tapis / Set Semula (A01, R1-21.5) | GET /api/questions accepts subjectId, educationLevelId, difficultyLevel, status, dskpFilter, complianceFilter, sourceFilter, search, tagReview, missing: no tahun, negeri, kertas or jenis filter (base 823d8dfb; none on t33, t30 or t13b) | missing | [t13b] filters "Semua subjek" and "Semua status" with Tapis / Set Semula; Tahun, Negeri, Kertas, Jenis absent (the API has none). The legacy list keeps its seven filters. | label differs | API gap behind the missing filters. D96 (Darjah hidden) is not a difference. |
| S4 | Columns No., Soalan, Kertas, Sumber, Status; 25 per page (A01, R1-21.5) | GET /api/questions (paged) | parity | [t13b] columns No., Soalan, Kertas, Sumber, Status as V2; 25 per page: unconfirmed. | parity | - |
| S5 | Row actions Pratonton, Edit / Edit sebagai draf, Sembunyikan (dialog "Arkibkan soalan ini?", Batal / Sembunyikan) (R1-21.5) | Archive via POST /api/questions/bulk-action; single-question POST /api/questions/:id/status and gate-check exist only on t33 | missing | [t13b] row actions Pratonton, Edit / Edit sebagai draf, Sembunyikan with the dialog "Arkibkan soalan ini?" (`lib/studio/status.ts`). | parity | API: single-question POST /api/questions/:id/status exists only on t33 (276a6622), not in base. |
| S6 | Entry "Cipta baharu" opens "Studio — Cipta soalan" (A02) | POST /api/questions (base) | parity | [t13b] button "Cipta baharu" on the list opens "Studio — Cipta soalan" (/admin/studio/questions/create). | parity | - |
| S7 | Wizard steps Kertas, Rangsangan, Sub-bahagian, Tag; "Langkah 4 Tag & pengelasan" (A02, PIPE AC-03.1) | POST/PUT /api/questions (base 823d8dfb); stimulus and stimulus-group API merged (T32, in base) | parity | t13 StudioEditorPage: "Langkah 1 Kertas & bahagian", "Langkah 2 Rangsangan (stimulus)", "Langkah 3 Sub-bahagian", "Langkah 4 Tag & pengelasan"; pill nav label "Bahagian borang" | parity | Step order and Langkah 4 title match; pill labels vs V2 tab words ("Kertas", "Tag") unconfirmed. |
| S8 | "Simpan draf" with flash "Soalan draf disimpan. Terbitkan melalui semakan apabila sedia." | PUT/POST /api/questions | parity | t13: button "Simpan draf" and the same flash text | parity | - |
| S9 | Status moves on the edit screen: "Hantar untuk semakan" (flash "Soalan dihantar untuk semakan."), "Terbitkan" (no confirm; flash "Soalan diterbitkan — kini boleh dijawab oleh pelajar."), "Arkib" (A03) | base 823d8dfb: only bulk-action; t33 (276a6622, not merged) adds POST /api/questions/:id/status and GET /:id/gate-check | missing | [t13b] StudioStatusBar buttons "Hantar untuk semakan", "Terbitkan" (no confirm), "Arkib"; flashes "Soalan dihantar untuk semakan." and "Soalan diterbitkan — kini boleh dijawab oleh pelajar."; extra [PROPOSED] "Kembali ke draf" and "Pulihkan ke draf". | parity | Team A: merge t33. FE ready on t13b. |
| S10 | Status bar text: Draft "Belum dipapar kepada pelajar."; Approved "Soalan ini boleh dijawab oleh pelajar." with a badge "Draft"/"Approved" (A03) | status returned by GET /api/questions/:id | parity | [t13b] sentences identical; badge words Draft, Reviewed, Approved, Archived (`lib/studio/status.ts`). | parity | - |
| S11 | Illegal move message "Peralihan '{from}' -> '{to}' tidak dibenarkan." (A03) | errors.ts TRANSITION_CONFLICT_MESSAGE: "Perubahan status daripada {X} kepada {Y} tidak dibenarkan." (base 823d8dfb) | label differs | [t13b] shows the server sentence on a refused move. | not applicable (V3 change or out of R1) | D94(1) approved the proposed BM copy, so the V2 wording does not apply here. |
| S12 | "Edit sebagai draf" creates draft #id at once; flash "Draf baharu #{id} dicipta. Soalan asal kekal diterbitkan sehingga draf ini diterbitkan."; direct edit blocked with "Soalan ini telah diterbitkan. Gunakan "Edit sebagai draf" untuk menyuntingnya." (A03, AC-02.4) | PUT /api/questions/:id on an approved question creates version n+1 as draft and keeps v1 serving (approved-servable.spec, base) | parity | [t13b] list row "Edit sebagai draf" creates the draft at once; flash "Draf baharu #{id} dicipta. Soalan asal kekal diterbitkan sehingga draf ini diterbitkan." (`draftCreatedFlash`). | parity | Earlier finding (draft created on Simpan) was about t13 only; t13b fixes it. |
| S13 | "Dilihat murid di" per activity, Boleh / Tidak boleh dilihat with reason, on the edit status bar and list (A29, AC-04.1) | GET /api/admin/servability/questions/:id and /questions/batch (t30 28a695ea, not merged; reports in t29 72a4048a, not merged) | missing | [t13b] status bar "Dilihat murid di x daripada n aktiviti" with a Lihat disclosure; also on the mobile card. | parity | Team A: merge t29 + t30. |
| S14 | DSKP/TP/cognitive level inside the Tag step; approval refusal list (AC-03.1/03.2) | Gate on t33 (dskp-gate.ts: "Bahagian (b) belum ada aras pemikiran."), not in base | missing | [t13b] approval refusal list under the heading "Soalan belum boleh diterbitkan — sila betulkan isu di bawah." (= V2 example); tag fields in StudioDskpFields. | parity | Needs t33 for the gate text. |

### 2 Bank Soalan and approve (legacy list, A11)

| Row | V2 (label / steps) | V3 API | API | V3 FE | FE | Note |
|---|---|---|---|---|---|---|
| B1 | "Tambah Soalan" button | POST /api/questions | parity | "Tambah Soalan" in 12 files (legacy list) | parity | - |
| B2 | Filters Subjek, Tahap, Kesukaran, Status, DSKP ("Ada DSKP Tag" / "Belum Ditag"), Compliance, Source | GET /api/questions (base) | parity | QuestionListPage.vue: same seven filters and "Semua ..." empties | parity | - |
| B3 | "Luluskan Hasil Tapisan" (needs a filter; confirm "Luluskan SEMUA soalan hasil tapisan ini? Ia akan kelihatan kepada pelajar."; guard "Sila pilih sekurang-kurangnya satu penapis") and "Arkib Semua" (A11, PIPE AC-03.3) | POST /api/questions/bulk-action takes ids only (limit 200); no filter-based action | missing | Neither string exists in any tree. V3 has selection-based bulk options Luluskan / Terbitkan / Tolak / Arkibkan / Padam (question-list.ts BULK_OPTIONS) | missing | Different mechanism (select rows vs act on the filter) and different labels ("Arkibkan" vs "Arkib Semua"). |
| B4 | Per-row "Luluskan" / "Arkib" | bulk-action with one id | parity | Row actions of the legacy list not read | unconfirmed | - |
| B5 | Quick Edit of an MCQ with gate message "Soalan ini tidak boleh ditanda seperti sedia ada" (A12) | PUT /api/questions/:id | parity | /admin/spm/soalan/:qid/sunting (BankEditPage) | unconfirmed | Gate message text not found in code (servability reasons are on t29). |

### 3 Import & Semakan (A05-A08)

| Row | V2 (label / steps) | V3 API | API | V3 FE | FE | Note |
|---|---|---|---|---|---|---|
| I1 | Menu "Import & Semakan" opens the batch list with tabs | POST/GET /api/intake/batches (base) | parity | Menu BS-02 "Import & Semakan" points to /admin/questions/import (CSV import). The batch list is "Senarai Ekstrak" (KS-14, /admin/spm/soalan/ekstrak). | label differs | Same menu word, different destination. |
| I2 | Tabs "Kelompok Item", "Kertas Diimport", "Kiriman Guru" | n/a (DOCX path dropped by D52; Kiriman Guru: no /api/question-submissions route) | not applicable (V3 change or out of R1) | None of the three strings exists. "Kiriman Guru" is not R1 (PIPE AC-02.6). | not applicable (V3 change or out of R1) | Out of R1 scope; recorded for completeness. |
| I3 | Batch list columns "Fail Sumber", "Subjek", "Bilangan Soalan", "Disemak", "Status", "Semak" | GET /api/intake/batches | parity | [hc-intake-parity eaef3360] columns "Fail Sumber", "Subjek", "Bilangan Soalan", "Disemak", "Status" and the link "Semak" (UX-30). "Disemak" has no V2 definition in the notes. | parity | V3-only columns dropped. |
| I4 | Upload: V2 has no screen (CLI only) | POST /api/intake/batches, /files, /extract | not applicable (V3 change or out of R1) | "Muat Naik Kertas" (KS-13), V3-only | not applicable (V3 change or out of R1) | V3 addition (D52). |
| I5 | Split pane: PDF left, editor right | GET /api/intake/files/:id/pages/:n/image, batches/:id/review | parity | IntakeReviewPage two panes (lg), "Sumber kertas" | parity | - |
| I6 | Item buttons "Terima (A)", "Tolak (R)", "Simpan Sunting (E)" on the same page | POST /api/intake/items/:id/accept/reject, PATCH /items/:id | parity | [hc-intake-parity] "Terima (A)", "Tolak (R)", "Simpan Sunting (E)" and shortcuts A / R / E on the open question of the batch page (UX-31); reject asks for a reason (UX-32; V3 route requires one). | parity | One deviation: the reject reason. |
| I7 | "Terima semua yang belum disemak" | POST /api/intake/items/bulk (base) with confidence band rule | parity | [hc-intake-parity] "Terima semua yang belum disemak" on the page; accepts only items the server accepts in bulk and says how many were skipped (UX-33). | parity | V3 keeps the single-accept gate (AC-07.4). |

### 4 Kontrak (A20, P4)

| Row | V2 (label / steps) | V3 API | API | V3 FE | FE | Note |
|---|---|---|---|---|---|---|
| K1 | Menu/screen name "Kontrak Simulasi", list "Senarai Kontrak" | GET /api/admin/blueprints (base) | parity | [hc-kontrak 08474528 + f08 menu] route header "Kontrak Simulasi", list "Senarai Kontrak", menu KS-08 "Kontrak Simulasi" (f08, UX-47). | parity | Base still says "Kontrak Blueprint". |
| K2 | Create: "Baharu" > dialog "Kontrak Baharu" with Subjek, Kertas, Sumber, Kod Kertas, Tempoh, Jumlah Markah, Boleh tanda auto, Nota; "Batal" / "Cipta" | POST /api/admin/blueprints (base) | parity | [hc-kontrak] button "Baharu", dialog "Kontrak Baharu" with Subjek, Kertas and a Sumber select; Kod Kertas, Tempoh, Jumlah Markah, Nota are set in the editor afterwards, then "Simpan". | step / click count differs | V2 asks all fields in one dialog (Baharu, fill, Cipta). V3 still has dialog then editor: one extra screen. Cipta button wording: unconfirmed. |
| K3 | Duplicate guard "Kontrak untuk subjek/kertas ini sudah wujud." | 409 CONFLICT blueprintExists (base) | parity | "Kontrak untuk subjek dan kertas ini sudah wujud." with "Buka kontrak" | label differs | D92(3) records the V3 wording (adds "Cipta versi baharu."). |
| K4 | Editor fields in order Kod Kertas, Tempoh (minit), Jumlah Markah, Sumber (Draf/Spec/Disahkan), Boleh tanda auto, Nota | blueprint write schema (base) | parity | [hc-kontrak] "Kod Kertas", "Tempoh (minit)", "Jumlah Markah", "Sumber" (V2 wording and order), "Nota"; no "Boleh tanda auto" (see K5). | parity | - |
| K5 | "Boleh tanda auto" checkbox | BijakBlueprintAdminCreate has no autoMarkable/languageMode (base, base) | missing | not present | missing | T44 (A3 dev-2) covers it. |
| K6 | Bahagian table: "Tambah Bahagian", "Label", "Peraturan Pilihan" (Tiada / Jawab Semua / Pilih N), "Markah", "Arahan (opsyenal)", "Mod Jawapan Dijangka" | sections[] with rule all/choose, markBudget, instruction, allowedModes | parity | [hc-kontrak] "Tambah Bahagian", "Label", "Peraturan Pilihan" (Jawab Semua / Pilih N), "Arahan (opsyenal)", "Mod Jawapan Dijangka"; V3 still adds the count M and budget-after-choose-N. | parity | V3 extras are kept (contract fields). |
| K7 | Flashes "Kontrak dicipta." / "Kontrak dikemas kini." / "Kontrak dipadam." | n/a | parity | [hc-kontrak] "Kontrak dicipta." / "Kontrak dikemas kini." / "Kontrak dipadam." | parity | - |
| K8 | Delete: "Padam kontrak" with confirm "Padam kontrak ini?" + long body about SEMUA kertas | POST /api/admin/blueprints/:subject/:kertas/retire; dependentPaperCount | parity | [hc-kontrak] row action "Padam"; confirm title "Padam kontrak ini?" and body "... Semua Bahagian kontrak turut dipadam. Ini menjejaskan pintu terbitan untuk SEMUA kertas subjek/kertas ini ..."; the delete is blocked while Terbit papers depend on it (V2 warns only). | label differs | Title and SEMUA text parity; the block is a V3 rule. |
| K9 | Banner "Kontrak dikongsi." with the shared-gate warning | dependentPaperCount (base) | parity | [hc-kontrak] SharedBanner "Kontrak dikongsi." with the per-subject warning and SEMUA sentence (list and editor wording). | parity | - |
| K10 | Empty state "Tiada kontrak lagi. Cipta kontrak pertama menggunakan butang "Baharu" di atas." | n/a | not applicable (V3 change or out of R1) | [hc-kontrak] "Tiada kontrak lagi. Cipta kontrak pertama menggunakan butang \"Baharu\" di atas."; filtered empty "Tiada kontrak dijumpai." | parity | - |
| K11 | Draf badge with " — sahkan dengan LPM"; Disahkan set by choice | POST /verify with evidence and checks (V3 stricter, D76) | not applicable (V3 change or out of R1) | "Sahkan" panel with evidence drawer, checks and Nota pengesahan | not applicable (V3 change or out of R1) | V3 change by decision (D76): Disahkan only through Sahkan. |

### 5 Set Builder and Semak Kertas (A09, A18, A19; P3, P5)

| Row | V2 (label / steps) | V3 API | API | V3 FE | FE | Note |
|---|---|---|---|---|---|---|
| P1 | Create blank set: "Cipta Set Baharu" / "Mula kosong", title field "Tajuk set kosong", optional subject; flash "Set komposit dicipta. Seret soalan ke dalam Bahagian untuk mula." | POST /api/admin/papers (base) | parity | f08 landing: "Mula kosong", "Tajuk set kosong", flash identical; subject AND kertas are required | step / click count differs | V2 title + optional subject; V3 also needs kertas (blueprint, D83 D-6). "Cipta Set Baharu" string absent (admin.md uses "Mula kosong"). |
| P2 | "Jana set" / "Ambil soalan secara rawak", fields title, subject, count, Tahun, Negeri; aside "Kolam soalan" "{n} soalan tersedia", "Anda meminta {k} daripadanya."; flash "{n} soalan dijana secara rawak. Semak sebelum menerbitkan." | POST /api/admin/papers/generate, GET /pool-preview (base) | parity | f08 copy: all five strings identical; filters Tahun/Negeri absent; count comes from the contract | step / click count differs | No Tahun / Negeri filter (API has none either). V2 count is free 1-100; V3 follows the contract. |
| P3 | Generated set publishes in 2 clicks (Jana set, Terbitkan) | POST /api/admin/papers/:id/publish | parity | f08: Jana set > opens builder > Terbitkan (no confirm for sets) | parity | Equal count (2). |
| P4 | Builder: "Bank Soalan" search "Cari soalan…", up to 150 rows ("Menunjukkan 150 teratas — tapis lagi untuk menyempitkan."), "Tiada soalan sepadan." | GET /api/admin/papers/:id/sections/:sid/pool (base) | unconfirmed | [f08 9aa080d5] search "Cari soalan…", 50 per page up to 150 rows, then "Menunjukkan 150 teratas — tapis lagi untuk menyempitkan." (UX-40), "Tiada soalan sepadan." | parity | API cap on the pool read: unconfirmed. |
| P5 | Per-question chips "Disematkan" and "Tidak disajikan"; buttons "Tambah" / "Buang"; rule "Jawab Semua" / "Pilih N" | review rows (t34 e363fe51, not merged): "Dilihat murid di n daripada 6" per row; the contract has no `pinned` flag per placed question | missing | [f08] "Tambah", "Buang", "Tidak disajikan", "Jawab Semua", chip "Disematkan" (drawn only when the answer carries `pinned`, UX-41); reorder by Naik / Turun (D83 D-9). | parity | Team A: add `pinned` to the builder answer (f08 asked for it, UX-41). |
| P6 | Totals "Jumlah markah keseluruhan: {n} markah"; title rename flash "Set '{title}' telah dinamakan semula." | PUT /api/admin/papers/:id | parity | f08 copy identical | parity | - |
| P7 | Contract panel "Kontrak Simulasi" with "Sunting kontrak"; warning "Set ini belum memenuhi kontrak penuh (K2 subjektif tiada)."; "Tiada kontrak untuk subjek/kertas ini." | GET /api/admin/papers/:id/review (base) | parity | f08: "Kontrak Simulasi", "Sunting kontrak", "Tiada kontrak ..." identical; warning replaced by "Blueprint perlu semakan" and blockers "{n} masalah menghalang penerbitan." | label differs | K2 subjektif is KIV. |
| P8 | "Lampir Kertas 2" / "Tanggalkan" | n/a | not applicable (V3 change or out of R1) | absent | not applicable (V3 change or out of R1) | KIV (R1-21.6): correctly absent. |
| R1 | Semak Kertas "Kemas kini metadata": Tajuk, Tempoh (minit), Kod kertas (kulit), Arahan kulit kertas; button "Simpan"; flash "Kertas '{title}' telah dikemas kini." | PUT /api/admin/papers/:id accepts title, year, durationMin, instructions, reference, sections: no cover code | missing | [f08] "Kemas kini metadata", Tajuk, Tempoh (minit), Kod kertas (kulit) read-only, Arahan kulit kertas; button "Simpan" and flash "Kertas '{title}' telah dikemas kini." (V2). | parity | Cover code is not editable (API): see the API gap. |
| R2 | "Sunting bahagian": Label bahagian, Peraturan menjawab, Bilangan soalan dipilih, Arahan bahagian; "Simpan bahagian"; flash "Bahagian '{label}' telah dikemas kini." | PUT /api/admin/papers/:id sections[{id,label,instruction,compulsory}]: rule and select count are set by the contract | missing | [f08] "Sunting bahagian", Label bahagian, Arahan bahagian, button "Simpan bahagian"; rule and count shown read-only (UX-43). | parity | V2 edits rule and count; V3 leaves them to the blueprint (design UX-43, no user decision found). |
| R3 | "Sunting petikan": "Tajuk petikan" + caption (≤240) + body editor; "Simpan petikan" | PUT /api/admin/papers/:id/groups/:groupId {label} (t34) | missing | [f08] "Sunting petikan", "Tajuk petikan", button "Simpan petikan"; no body or caption editor (UX-43, D90 shared stimulus). | parity | Body and caption edit missing by design. |
| R4 | "Bahan rujukan (kulit kertas)": "Tambah panel", "Tambah gambar", "Tambah teks / rumus", "Simpan bahan rujukan"; flash "Bahan rujukan kertas telah dikemas kini." | PUT /api/admin/papers/:id {reference}: the field is read-only in base; the write and image validation are on t34 (e363fe51, not merged) | missing | [f08] PaperReferenceEditor: "Bahan rujukan (kulit kertas)", "Tambah panel", "Tambah gambar", "Tambah teks / rumus", "Simpan bahan rujukan", flash "Bahan rujukan kertas telah dikemas kini." (UX-44). | parity | API on t34 (not merged). |
| R5 | "Soalan Tambahan": "Tambah bahagian", "Tambah soalan" (Nombor soalan, Jenis jawapan, Markah; "Tambah & sunting"), "Padam soalan" with confirm; errors "Nombor soalan {x} sudah digunakan dalam kertas ini." / "Soalan hanya boleh ditambah ke bahagian yang dicipta oleh admin." | V3: extra question = place one more bank question beyond the contract (placements, t34); no create-blank-question or admin-made Bahagian route | missing | [f08] PaperQuestionOps: "Tambah soalan" and "Padam soalan" with the V2 confirm text, through t34 placements; no "Soalan Tambahan" heading, no "Tambah bahagian", no Nombor soalan / Jenis jawapan / Markah form. | label differs | V2 creates a blank question inside the paper; V3 places a bank question. |
| R6 | "Salin untuk sunting" (live banner) / "Salin set"; flash "Set disalin sebagai draf. Sunting dan terbitkan salinan baharu." | POST /api/admin/papers/:id/copy (base) | parity | [f08] "Salin set" and the live banner button "Salin untuk sunting"; same flash and locked note. | parity | - |
| R7 | "Penerbitan" panel: live text "Kertas ini sedang DITERBITKAN — pelajar boleh mengaksesnya di Simulasi."; "Terbitkan" (disabled with blockers); "Sembunyikan" | POST /publish, /withdraw (base) | parity | [f08] "Penerbitan", live text identical, "Terbitkan" disabled with reason, withdraw button "Sembunyikan" (UX-45). | parity | - |
| R8 | Publish confirm "Terbitkan kertas ini? Ia akan terus boleh diakses pelajar di Simulasi." for native papers | n/a | not applicable (V3 change or out of R1) | [f08] native paper asks "Terbitkan kertas ini? Ia akan terus boleh diakses pelajar di Simulasi." (UX-46); sets in the Set Builder keep no confirm. | parity | - |
| R9 | Blockers "Belum boleh diterbitkan", "{n} masalah"; flash "Kertas ini belum boleh diterbitkan — {n} masalah perlu dibetulkan." | GET /review (base) | parity | f08 copy identical (blockers, notPublishable, publishedFlash, withdrawnFlash) | parity | - |
| R10 | Override tick "Terbitkan walaupun tidak memenuhi kontrak blueprint" (Panel text: "...kontrak Simulasi"), audited | POST /publish with override + reason (t34, audited, not merged). `canOverride` / `overridable` flags and structured blockers are not in the contract; the T34 follow-up for them is not pushed (t34 head e363fe51) | missing | [f08] tick text identical; offer reads `overridable` / `canOverride` when present and otherwise a text heuristic (e1546909); adds a reason field (>= 5 characters, UX-46). | step / click count differs | Team A: structured blockers + canOverride. |
| R11 | "Isu import ({n})" list | n/a | not applicable (V3 change or out of R1) | absent | not applicable (V3 change or out of R1) | DOCX importer dropped (D52). |
| R12 | Lane/paper list: filters Subjek, Cari; columns Tajuk, Status, Perhatian, Tindakan; actions Pratonton, Salin, Sunting (P2) | GET /api/admin/papers (status filter only); GET /api/admin/servability/lanes/bijak-spm gives title, status, questionCount, attentionCount (t30) | missing | [f08] paper list columns Tajuk, Status, Perhatian, Tindakan; actions "Pratonton (baca sahaja)", "Salin", "Sunting" (UX-42). Perhatian is derived from the paper summary until the t30 lane list is in base. Filters Subjek and Cari: unconfirmed. | parity | API still lacks subject/search filters on the paper list. |

### 6 Laporan Soalan (admin, A15)

| Row | V2 (label / steps) | V3 API | API | V3 FE | FE | Note |
|---|---|---|---|---|---|---|
| L1 | Admin triage list /admin/question-reports with statuses and notes | GET/PATCH /api/question-reports (base) | parity | m04 QuestionReportsPage "Laporan Soalan — Admin Panel" (tab title) / header "Laporan Soalan" | unconfirmed | V2 (.cloud) admin labels are not recorded in the repo; the V3 labels follow the .my URS (v2-question-bank.md). |
| L2 | Row actions: "Tandakan Selesai", "Tolak & Aktifkan Semula", "Nyahaktif Segera" with notes box "Nota admin" | PATCH :id {status, adminNotes, reactivate, forceDeactivate} | parity | ReportCard (base): "Tandakan Selesai", "Tolak & Aktifkan Semula", "Nota admin" and "Nyahaktif Segera" are all present. | parity | Earlier 'not found' was a scan miss. V2 .cloud wording itself stays unconfirmed. |
| L3 | Hide/archive the reported question from the row (admin.md A15: "unverified"; R1-18.4 "Arkib") | PATCH :id {archive:true} archives through the lifecycle (T35, merged: BASE-18) | parity | [hc4-report-arkib b458c8f3] ReportCard action "Arkib" next to "Tandakan Selesai" / "Nyahaktif Segera"; base has none. | parity | Team C: merge hc4. |
| L4 | Report shows question, paper and status | question_reports has no paper column in base; t42 (d1210e96, not merged) adds attemptId / paperId and the stored paper | missing | ReportCard shows source set label and question id | unconfirmed | R1-18.1/18.3 need the paper; T42 (A2). |

### 7 Kandungan SPM hub and lanes (A21, P1, P2)

| Row | V2 (label / steps) | V3 API | API | V3 FE | FE | Note |
|---|---|---|---|---|---|---|
| H1 | Hub "Kandungan SPM": six lane cards in order Databank Soalan, Tracking A, Subjektif, Bijak SPM, Kertas Subjektif, Latih Tubi with descriptions, attention count and "Buka senarai"; "Semua elok" | GET /api/admin/servability/overview: per activity {served, total, attention, basis} (t30 28a695ea, not merged) | missing | [hc-kandungan-hub b2424eb0] hub "Kandungan SPM": six lane cards in V2 order with V2 descriptions, attention count, "Buka senarai", "Semua elok"; lanes outside R1 show the card without a button. | parity | One lane test pending on the branch (wip). |
| H2 | Attention labels "tidak boleh ditanda", "set tidak lengkap", "tiada skema — tidak disajikan", "tiada kunci jawapan" | Servability reasons carry BM sentences from one table (t29 72a4048a, not merged); not the V2 phrases | missing | [hc-kandungan-hub] attention text uses the servability sentences (D94 copy) with the word "perlu perhatian"; V2 phrases such as "tidak boleh ditanda" are not used. | label differs | Wording differs by design (D94 approved the reason copy). |
| H3 | Lane "Databank Soalan": filters Subjek ("Semua Subjek"), Status ("Semua Status"), Cari; Tapis / Set Semula; columns Senarai, Tajuk, Perhatian, Tindakan | GET /api/admin/servability/lanes/databank {subjectId, status, search, page} (t30, not merged) | missing | [hc-kandungan-hub] lane "Databank Soalan" at /admin/spm/databank: Semua Subjek, Semua Status, Cari, Tapis / Set Semula; columns Senarai, Tajuk, Status, Perhatian, Tindakan. | parity | API on t30 (not merged). |
| H4 | Lane "Bijak SPM": paper list with Perhatian text ("Disajikan tetapi tiada soalan", "Ada soalan tanpa skema jawapan"), status label, row Sunting > review | GET /api/admin/servability/lanes/bijak-spm {title, status, questionCount, attentionCount, reasons} (t30, not merged); reason wording differs (servability copy) | missing | [hc-kandungan-hub] lane "Bijak SPM": paper rows with "Disajikan tetapi tiada soalan" or the servability sentences, status Terbit / Draf, action Sunting. | parity | Reason wording differs by design (servability copy). |
| H5 | Row actions "Pratonton (baca sahaja)", "Salin", "Sunting"; disabled control "Editor dalam panel akan datang" | POST /api/admin/papers/:id/copy, student-view (base) | parity | [f08 + hc-kandungan-hub] "Pratonton (baca sahaja)" (f08), "Salin", "Sunting" (lane); the control "Editor dalam panel akan datang" is not built. | parity | - |

## 5. Limits

- Code and copy tables were read; no screen was rendered, so layout, keyboard shortcuts (A/R/E) and click paths are marked unconfirmed where the code does not state them.
- The V2 reference is the repo's discovery documents, not the live site. Labels the documents do not quote (most of Laporan Soalan admin) are "unconfirmed".
- FE rows tagged with a branch describe that branch head; hc-kontrak-parity and hc-kandungan-hub are marked work in progress by their own commits.
- Student-side parity is out of scope here (see `docs/qa/r1-student-parity-check.md`).
