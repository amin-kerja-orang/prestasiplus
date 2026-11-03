# Admin question-entry wizard: V3 PRD vs V2 (read-only verification, 2026-11-04)

Specs read: `docs/prd/r1/30-admin-pusat.md` (s0, s3, s4.0 QE-01..08, s4.A Q-01..Q-24, s4.G, 4.V), `40-cross-cutting.md` FR-X1-4, plus `50-data-model-erd.md` (DM-01..06) and `60-api-contract.md` (API-Q-08/12/13/24/25) where the admin spec points to them.
V2 ground truth: `.evidence/v2-screens/admin|panel` (.txt + 1280 images for Studio edit, Set Builder). V3 code: `apps/api/src/modules/questions/{group-members.ts,stimuli.service.ts,http/stimuli.controller.ts}`, `packages/contract/src/questions/{stimuli.ts,parts.ts}`, `intake/workflow/figure-links.ts`.
Status vocabulary: Same / Improved / Missing / Dropped. No names or credentials copied from captures. Copy marked [PROPOSED] needs the D94 copy review.

## 1. Inventory (V2 function -> PRD)

| ID | V2 function | V2 page (route) | PRD ID | Status | Note |
|---|---|---|---|---|---|
| V01 | Status tiles Draft / Reviewed / Approved / Archived with counts | Studio `/admin/studio` | Q-03 | Same | Reviewed tile = single review queue (FR-Q03.6) |
| V02 | Filters Semua subjek / status / tahun / negeri / kertas / jenis + `Tapis`, `Set Semula` | Studio | Q-03 | Same | V3 adds Tingkatan, Bab, DSKP |
| V03 | Columns No., Soalan (90 chars), Kertas, Sumber, Status; 25 per page | Studio | Q-03 | Same | |
| V04 | Row actions `Pratonton`, `Edit` | Studio | Q-03 | Same | |
| V05 | Panel row action `Sembunyikan` | Panel `/studio` | Q-03 (spec text only, no FR) | Missing | Behaviour never specified (gap m1) |
| V06 | Link `Bank lama (legasi) ->`, `Cipta baharu`, Panel `Cipta di Studio` | Studio | Q-03 | Same | |
| V07 | `Import DOCX (ZIP)` button + modal ("Muat naik & proses") | Studio | QE-05, FD-QE-4 | Dropped | PDF replaces it (D52); justified |
| V08 | `Import BI Kertas 1` modal (`Fail soalan (DOCX) *`, `Fail skema jawapan (DOCX) - pilihan`, `Tajuk kertas - pilihan`) | Studio | Q-08 | Dropped | PDF + optional skema PDF; optional `Tajuk kertas` not carried (acceptable) |
| V09 | Draft-recovery banner `Pulihkan` / `Buang` | create + edit | Q-04 | Same | screen spec only |
| V10 | "Sumber soalan:" badge | edit | Q-04 | Same | |
| V11 | Status bar: `Status`, badge, "Belum dipapar kepada pelajar.", `Pratonton`, `Hantar untuk semakan`, `Arkib` (+`Terbitkan`) | edit | Q-04 | Same | |
| V12 | Tab strip `Kertas / Rangsangan / Sub-bahagian / Tag` | create/edit | QE-03.1 | Improved | Data collected Tag-first; tab order not stated (gap m2) |
| V13 | Langkah 1 `Kertas (pilihan)` picker (100+ papers incl. test papers) | create/edit | QE-03, 4.V | Improved | Filtered by Subjek/Tahun/Negeri |
| V14 | `Bahagian` select | create/edit | 4.G.5 step 3 | Improved | From the contract |
| V15 | `Nombor soalan` field | edit | 4.G.5 step 3 | Same | |
| V16 | `Teks soalan (stem)` textarea, placeholder "Contoh: Rajah 1 menunjukkan..." | edit | none | Missing | Not in Q-04 field list; the V2 placeholder itself invites the figure-in-stem defect (gaps M3, M6) |
| V17 | Langkah 2 `Jenis rangsangan`, 15 kinds (Passage, Box, Table, Diagram, Graph, Image, Infographic, Code, Pseudocode, Sql, Math, Audio, Video, Map, Cartoon) | create/edit | QE-02.1 | Dropped | V3 contract has 7 kinds; no FD row records the drop (gap M7) |
| V18 | `Kapsyen (pilihan)` | create/edit | QE-02.1 | Same | |
| V19 | Rich editor toolbar (B, I, lists, code, Jadual, +Baris, +Lajur, xJadual, math inline/block, Imej, undo/redo) + math dialog | create/edit | QE-02.1 | Same | toolbar not enumerated in an FR |
| V20 | Note "Matematik dipaparkan terus (MathML statik)..." | create/edit | Q-04 | Same | |
| V21 | Stimulus entered per question (no reuse) | create/edit | QE-02 | Improved | group-first; the central fix |
| V22 | Langkah 3 part tree: `Label`, `Jenis jawapan`, `Markah`, `Arahan sub-bahagian` | create/edit | QE-03.3 | Same | |
| V23 | 14 answer modes | create/edit | QE-03.2, FD-QE-2 | Dropped | -> 8 types (exam-schema D1). PRD says "13 modes" but lists 14 (typo, m8) |
| V24 | `Had perkataan` (word limit) on essay parts | edit | none | Missing | Not in PRD or V3 contract (gap M6) |
| V25 | `+ Jawapan diterima` (create) / `+ Isi skema` (edit) accepted-answer rows | create/edit | QE-03.3, 4.G.5 step 6 | Improved | K/N/P scheme (D4) |
| V26 | `+ Sub-bahagian`, `Buang`, `+ Bahagian utama`, collapsible rows | create/edit | QE-03.3 | Same | buttons not named in an FR |
| V27 | Running "Jumlah markah {n}", summary "(?) - short_text - 1 markah", tick, "tiada skema" | create/edit | QE-04 | Same | |
| V28 | Langkah 4 `Bab` (options are actually SP sentences) | create/edit | QE-03.1, Q-04.2 | Improved | real Bab + DSKP Unit/SP/TP |
| V29 | `Topik` select | create/edit | 4.G.1 | Same | optional |
| V30 | `Kesukaran` Mudah/Sederhana/Sukar | create/edit | QE-03.7 | Improved | Tahap kesukaran 1-5 + TP; label derived |
| V31 | Save bar "{n} markah - {m} belum lengkap" + `Simpan draf` | create/edit | QE-04 | Improved | names the missing fields |
| V32 | Preview page (SULIT, "Pratonton - Draft.", marks, "0 patah perkataan") | `/admin/studio/questions/{id}/preview` | QE-01 | Same | group preview shows stimulus once |
| V33 | Flash / transition copy | edit | Q-04 | Same | |
| V34 | `Edit sebagai draf` clone of approved | Studio | Q-03.3 | Same | |
| V35 | Tab `Kelompok Item` (Fail Sumber, Subjek, Bilangan Soalan, Disemak, Status, `Semak`) | `/admin/studio/imports` | Q-07 | Same | |
| V36 | Tab `Kertas Diimport` (`Semak & Terbit`) | imports | Q-07.3, .6-.9 | Improved | V2 empty; V3 builds batch->paper |
| V37 | Tab `Kiriman Guru` (tiles, filter, table, empty copy) | `/admin/question-submissions` | Q-12 | Same | real backend added |
| V38 | Review page: Item i/n, `Terima semua yang belum disemak`, `Terima (A)`, `Tolak (R)`, `Simpan Sunting (E)` | review | Q-09 | Same | not captured in V2, from code |
| V39 | Senarai Soalan: banner, tabs, summary, 7 filters, `Tambah Soalan`, `Import CSV`, `Luluskan Hasil Tapisan`, `Arkib Semua`, row `Luluskan`/`Arkib` | `/admin/questions` | Q-20 | Same | typed confirm added |
| V40 | Import CSV page (dead in V2) | `/admin/questions/import` | Q-11, QE-06 | Improved | V2 not connected |
| V41 | Tabs `Kualiti`, `Laporan` | questions | Q-21, Q-22 | Same | V2 quality figures contradict; V3 computes |
| V42 | Soalan Berstruktur list (tiles, Agihan, `Pemarkahan:` filter) | `/admin/structured-questions` | Q-23 | Same | |
| V43 | Rubric editor (`Poin Rubrik`, `Tambah`, `Simpan Skema & Rubrik`) | structured detail, Panel subjektif edit | Q-23.2 | Dropped | -> Studio K/N/P (D4); adds a click via `Sunting di Studio` |
| V44 | Set Builder landing: `Mula kosong`, `Jana set`, `Kolam soalan` warnings, `Set sedia ada` | `/admin/studio/sets` | Q-13 | Same | |
| V45 | Builder: bank filters, `Tambah`, "Bahagian destinasi", rule `Jawab Semua`/`Pilih N`, `Buang`, `Terbitkan`, error copy | builder | Q-14 | Same | groups added |
| V46 | Panel builder: rename, chips `Disematkan` / `Tidak disajikan`, override checkbox | Panel | Q-14, Q-15 | Same | chips have no FR (m5) |
| V47 | Paper review: metadata, `Bahan rujukan`, `Isu import (n)` + `Lihat`, `Sunting bahagian/petikan/soalan`, `Tambah/Padam soalan`, `Salin set`, `Terbit`/`Tarik balik` | Panel review | Q-15 | Same | `Isu import` has no FR (m5) |
| V48 | `Kontrak Simulasi` list/editor (`Kod Kertas`, `Tempoh`, `Jumlah Markah`, `Sumber` Draf/Spec/Disahkan, `Boleh tanda auto`, `Nota`, Bahagian table) | Panel `/spm/kontrak` | Q-16 | Same | `Disahkan` only via Pengesahan = Improved; modes -> 8 types |
| V49 | Tracking A lane + set editor (`Isi set`, `tukar`, `buang`, `Simpan`) | Panel | Q-17 | Same | groups as units added |
| V50 | Hub `SPM` 6 cards, lane lists, `lihat sisi pelajar`, Quick Edit | `/admin/spm`, `/spm/*` | Q-01, Q-02, Q-24 | Same | |
| V51 | Kertas Subjektif list (`Halaman`, `Pratonton`, `Sembunyi`, `Padam`, `Baharu`) | `/admin/kertas-subjektif`, `/spm/kertas` | Q-18 | Improved | page images -> editable text (D81); `Halaman` column dropped |
| V52 | Sumber Kertas list + detail (`Sunting di Studio`) | `/admin/source-papers` | Q-19 | Same | |
| V53 | PKSK Soalan list + `Tambah Soalan` (Bahagian A Insaniah / B Intelek / C Esei, Domain, Level) | `/admin/pksk/questions` | menu only (3.1, 3.3) | Missing | no screen spec (gap M8) |
| V54 | Kurikulum / Subjek / Tahap Pendidikan | `/admin/curriculum` etc. | C-01..C-03 | Same | not audited in depth here |
| V55 | Diagram audit (`gambar-rajah`), V3-only page, needed for "gambar tiada" | V3 | Guru PRD 44c only | Missing | no Admin Pusat menu entry or spec in 30 (gap M5) |

Tally of the 55 rows (dual-status rows counted once): Same 29, Improved 12, Missing 5 (V05, V16, V24, V53, V55), Dropped 6 (V07, V08, V17, V23, V43, plus V51 `Halaman` column counted under Improved; so 5 strict Dropped + 1 partial).

## 2. DSKP order and stimulus/group fix: end-to-end verification

DSKP order. FR-ADM-QE3.1, AC-QE3.1 and 4.G.5 collect Subjek, Tingkatan, Tajuk DSKP (Unit), SP (1-3), TP, KBAT, Bab, then Kertas/Bahagian, Rangsangan, Sub-bahagian. This matches the DSKP tree (Subjek > Tingkatan > Unit > SK > SP > TP) and fixes V2 (V2 asks Kertas first; its "Bab" list is really SP sentences). Residual: (a) tab strip order after the reorder is not stated; (b) Pengelompokan (Bidang/Tema) is not a picker, so unit lists are long for some subjects; (c) the `Kumpulan rangsangan` start has no Subjek/Tingkatan (code derives them from the first member). Verdict: order FIXED in the spec, three small ambiguities.

Defect paths (S = splitting still possible, or the PRD cannot be passed as written):
| Path | Result | Evidence |
|---|---|---|
| Manual wizard, group first (QE-02, 4.G.5) | Fixed: one stimulus, 1..n members, no re-upload | |
| Manual single question typing "Rajah 3 menunjukkan..." with no stimulus | **S**. Flags (G7.1) only exclude from pupils; publish gate (QE-04.2) does not list it | QE-04, API-Q-12 |
| Group of 4 with only Q5 approved/served | **S**. Code allows building a group while its first member is served (group-members.ts header); pupil gets a group of 1; AC-QE7.3 "never fewer than 4" is untestable | group-members.ts |
| CSV (QE-06) | Partly fixed: `group_key` + stimulus on row 1 only; no kind/label/caption/alt, no 2nd-3rd stimulus, no attach to existing group, no order/contiguity rule, re-import duplicates | QE-06.1 |
| PDF/OCR (QE-05) | Partly fixed: linking is by numbered keyword only (`figureKeys` needs "Rajah 3"); unnumbered "Rajah di atas", "Rajah menunjukkan", "Jadual di atas", "Maklumat di bawah", "Sumber/Teks" are not linked (V2 captures are full of them); an item naming two figures links to the first only (`several` has no spec) and a question can be in one group only (`memberTaken`) | figure-links.ts |
| Review screen (QE-05.4, Q-09) | Range edit/detach/attach fixed; undefined: `Tolak` on the stimulus, `Tolak` on a member, Terima of a member before its group exists | Q-09.5 |
| Publish gate | No group-level gate and no flag gate | QE-04 |
| Edit an existing published group (add/remove/reorder/change figure) | **S/blocked**. Code returns 409 `groupServed` / `stimulusServed` when any member is served. AC-QE1.2 and AC-Q05.1 cannot pass on published content; PRD gives no draft path for a group | stimuli.service.ts, group-members.ts |
| Move a question between groups | Code: remove then add (`memberTaken`), blocked if served. QE2.3 lists remove/attach only, no `Pindah` UI | group-members.ts `move` |
| Delete stimulus / dissolve group | Fixed by QE1.4 + DM-02 (refused while members exist). Residual: removing a member whose text says "Rajah 3" leaves it stimulus-less silently | QE1.4 |
| Versioning | Membership is on the question (not the version), so n+1 drafts keep the group; PRD Q04.5 covers only a question in a Terbit paper; stimulus versioning of a served group unspecified | questions.service.ts |
| Pupil display | Fixed (FR-X1-4d, FR-MUR-QP-1..4: once, above, sticky, never numbered). Gap only in the partial-group case | 40, 10 |
| Papers and generation (QE-07, Q-14, Q-17) | Fixed (units). Gap: `Pilih N` over a group's members | QE-07 |

Regroup work-list (QE-08, API-Q-13/24, DM-04/06, G7). Specified: detection of figure-only rows, numbered "Rajah n" without figure, duplicated images; audit; counts; ownership (U-OP-17); "gambar tiada". NOT fully specified: (1) unnumbered references cannot be detected by `figure-links.ts`, so QE-08.1(b) misses most V2-style rows (e.g. "Rajah menunjukkan dua contoh produk...", "Maklumat di bawah menunjukkan..."); (2) case (c) duplicated image on consecutive approved, unflagged questions: DM-04 only unlocks flagged members, so the regroup call hits 409 `memberServed`; (3) regroup changes content (stem image moves to the stimulus): new version and re-approval would be refused by the DSKP gate for untagged legacy questions (D80 DEC-2); (4) no grouping suggestion or neighbour context (paper + number order) in the list; (5) "gambar tiada" rows must lead to the diagram-audit upload, which has no Admin Pusat menu entry.

## 3. Gap list with buildable fixes

### BLOCKER

**B1 A stimulus group is published and served as one unit.**
- Rule: a group is servable only when ALL members are `approved` and complete. Otherwise every member shows `Tidak boleh dilihat` with reason "Kumpulan belum lengkap - {n} soalan belum diluluskan." [PROPOSED] on every surface (Latih Tubi, Databank, Bab, Kuiz, Jana, games, papers). No pupil gets a partial group.
- Admin: group page button `Terbitkan kumpulan` (enabled when members >= 1 and each passes the QE-04 gate). Approves all members in one transaction via `POST /api/stimulus-groups/:id/publish` (new, Admin Pusat, audited; 422 lists "Soalan {no}: {mesej}"). Per-member `Terbitkan` inside a group is disabled with title "Terbitkan melalui kumpulan." [PROPOSED].
- Data/API: derive `group_servable` in `questions/serving/rules.ts` (same code as the pupil draw, FR-Q06.2). Remove the "add draft members while the first is served" allowance from `GroupMembers` for served groups (replaced by B2).
- AC: Given a group of 4 with 3 approved and 1 draft, the 3 show the reason above and Latih Tubi never draws them; after `Terbitkan kumpulan` all 4 draw together (extends AC-QE7.3).

**B2 Editing a published group goes through a draft copy.**
- Rule: stimulus edit and member add/remove/reorder on a group with a served member stay refused in place (keep the 409). `Sunting kumpulan` clones the group (stimuli copied, members re-versioned as drafts n+1) as a draft; `Terbitkan kumpulan` swaps atomically; question ids and pinned sittings are unchanged.
- UI on a served group: banner "Kumpulan ini sedang dipaparkan kepada murid. Tekan `Sunting kumpulan` untuk menyunting salinan draf; yang asal kekal diterbitkan sehingga draf ini diterbitkan." [PROPOSED]; button `Sunting kumpulan`; flash "Draf kumpulan #{id} dicipta." [PROPOSED].
- API/DM: `POST /api/stimulus-groups/:id/edit-as-draft` -> `StimulusGroupDetail`; column `stimulus_groups.draft_of_group_id` nullable, at most one open draft per group.
- Rewrite AC-QE1.2 and AC-Q05.1: "on a draft group; on a published group via `Sunting kumpulan` then `Terbitkan kumpulan`; afterwards the pupil sees the new figure/order, and a sitting in progress keeps its pinned version."

**B3 Regroup works for served members and does not trip the DSKP gate.**
- `POST /api/admin/questions/regroup` (API-Q-24) accepts served, unflagged members. Define it as an in-place structural change (membership + removal of the member's own duplicate stem image, now supplied by the stimulus), NOT a new version and NOT a status transition, so the DSKP gate (transition-into-approved only) does not run. Audit stores before/after image ids; undo via `POST /api/admin/questions/regroup/:auditId/undo` [PROPOSED].
- The regroup transaction bypasses the served lock (flag `regroup=true` in `GroupMembers`); normal routes keep DM-04. The group becomes servable only when all members are approved (B1).
- AC: three consecutive approved Sains T4 questions carrying the same image are regrouped: 1 stimulus, 3 members, member stem images removed, status still `approved`, pupil sees the figure once above the 3.

### MAJOR

**M1 Detect unnumbered and positional references; multi-stimulus items.** Extend `figure-links.ts` and the G7.1/QE-08.1 predicates: keywords add `sumber`, `teks`, `text`, `maklumat`, `pernyataan`, `situasi`, `gambar rajah`, and positional phrases (`di atas`, `di bawah`, `berikut`, `above`, `below`, `following`) next to a figure word, with no number needed. Unnumbered refs are never auto-linked: they set `stimulus_missing` and show in the work-list with column `Rujukan` = "tanpa nombor". In extraction an unnumbered reference is suggested to the nearest preceding stimulus on the page, with confidence in the QE-05.4 group header; the admin confirms. An item naming 2 figures takes both stimuli into its group (max 3). If they sit in different groups, Terima is blocked with "Soalan merujuk dua rangsangan dalam kumpulan berbeza. Gabungkan kumpulan atau pilih satu." [PROPOSED] and action `Gabungkan kumpulan`. AC: an item "Rajah di atas menunjukkan..." after a figure item is suggested into that group.

**M2 Group screen fields (Q-05, QE-02.1).** List the contract fields: `Label` ("Rajah 3", required; drives figure matching), `Jenis rangsangan`, `Kapsyen (pilihan)`, `Teks alternatif` (required for image/diagram/map/infographic/graph; "Sila isi teks alternatif untuk imej ini." [PROPOSED]), `Sumber petikan (pilihan)`, `Bank pilihan` (A-H, max 8, for BI Part 4/5 per G6.3), buttons `Tambah rangsangan` (2nd/3rd stimulus, max 3; message `STIMULUS_MESSAGES.stimuliCount`), `Pratonton kumpulan` (as pupil sees it), `Tambah soalan`, `Naik` / `Turun`, `Buang`, `Pindah ke kumpulan lain` (m3).

**M3 Publish gate blocks figure-in-stem defects.** QE-04.2 adds "Soalan menyebut {Rajah 3} tetapi tiada rangsangan. Pilih kumpulan atau tambah rangsangan." (flag `stimulus_missing`) and "Soalan ini hanya mengandungi rangsangan. Tukarkan kepada rangsangan kumpulan." (`figure_only`) [PROPOSED]. `Terbitkan` is refused while either flag is open and not dismissed with `Bukan masalah`. Replace the V2 stem placeholder with "Contoh: Antara yang berikut, yang manakah..." and show under the stem, live, "Teks ini menyebut {Rajah n}. Letakkan rajah dalam rangsangan kumpulan." when the stem names a figure and no stimulus is attached. AC: a stem "Rajah 1 menunjukkan..." with no stimulus cannot be published.

**M4 CSV group columns (QE-06.1).** Add: `group_key`, `group_order` (1..n unique per key, default row order), `stimulus_label`, `stimulus_kind` (one of the 7), `stimulus_caption`, `stimulus_body_ms`, `stimulus_body_en`, `stimulus_image` (file name inside an uploaded ZIP; CSV-only accepts text kinds), `stimulus2_*` and `stimulus3_*` (same set), `group_id` (attach to an existing group, exclusive with stimulus columns), `stem_ms`, `stem_en`. Validation: rows of one key contiguous, same subject/Tingkatan/kertas ("Baris {n}: kumpulan {key} bercampur subjek atau kertas."); stimulus fields only on the first row ("Baris {n}: rangsangan hanya pada baris pertama kumpulan."); a key already imported in the batch is rejected ("Kumpulan {key} sudah diimport dalam kelompok ini."); a row naming a figure without stimulus warns and sets the flag. The template (`GET /api/question-imports/template`) carries one example group.

**M5 Diagram audit in the Admin Pusat menu.** The regroup list reports "gambar tiada" but the page that uploads the image (V3 `DiagramAuditPage`, API-Q-21) is not in 3.2/3.3. Add item `Audit Rajah` [PROPOSED] in group `Soalan` (route `/admin/diagram-audit`), columns `Soalan`, `Subjek`, `Tingkatan`, `Sebab`, actions `Muat naik gambar` (attaches once to the group's stimulus) and `Bukan masalah`, and a row action `Muat naik gambar` in tab `Perlu dikumpulkan semula`. Needs a user decision (FR-X1-2: menu change).

**M6 Missing wizard fields from V2.** (a) Question-level `Teks soalan (stem)` rich text {ms,en} for the single-leaf case. (b) Per leaf `Had perkataan` (integer >= 1, optional, shown for `Karangan / Respons Terbuka` and `Jawapan Pendek`; pupil counter "{n} patah perkataan" as V2; "Had perkataan mesti nombor positif." [PROPOSED]); contract `part.wordLimit` nullable, stored in the part answer config JSON.

**M7 Stimulus kinds.** Record in the FD table: V3 offers 7 kinds (`Petikan`, `Imej`, `Rajah`, `Jadual`, `Peta`, `Infografik`, `Graf`). V2 Box, Cartoon, Code, Pseudocode, Sql, Math, Audio, Video had zero rows (exam-schema line 84) and are dropped. Add `Kod / Pseudokod` (monospace, never executed) for Sains Komputer and map V2 `Box` to `Petikan` with style `kotak`. `Audio` (listed in exam-schema D6): record the decision (recommend omit at R1, add to open questions).

**M8 PKSK Soalan has no spec.** Add R1-ADM-Q-25 `Soalan PKSK` `/admin/pksk/questions`: tiles `Jumlah`, `Diluluskan`, `Menunggu`, per Ting. counts; filters `Semua Bahagian` (A - Insaniah, B - Intelek, C - Esei), `Semua Level` (Tingkatan 1, Tingkatan 4), `Semua Status` (Menunggu, Diluluskan, Ditolak), `Cari`; columns `Soalan`, `Bahagian`, `Domain`, `Level`, `Status`, `Tindakan`; button `Tambah Soalan`. State that PKSK questions are outside the stimulus-group and DSKP rules (code: a PKSK question cannot join a group).

### MINOR
- m1 `Sembunyikan` (Panel Studio row): specify as shortcut to `Arkib` with confirm "Sembunyikan soalan ini daripada murid?" [PROPOSED], or drop it with an FD row.
- m2 Tab strip order becomes `Tag`, `Kertas`, `Rangsangan`, `Sub-bahagian`, numbered 1-4. `Kumpulan rangsangan` takes Subjek/Tingkatan from its first member and shows "Subjek ditetapkan oleh soalan pertama." [PROPOSED].
- m3 Move between groups: group row action `Pindah ke kumpulan lain` opens a picker (same subject and kertas) and runs remove+add in one call; a served member uses B2; show `STIMULUS_MESSAGES.memberTaken` in BM on conflict.
- m4 Removing a member whose text names a figure: confirm "Soalan ini menyebut {Rajah 3}. Tanpa kumpulan ia tidak akan dipaparkan kepada murid." [PROPOSED] and set `stimulus_missing`. Change the `smallGroup(1)` warning ("lazimnya untuk sekurang-kurangnya 2 soalan") which contradicts D108(1): no warning for 1 member.
- m5 Add FRs for V2 items that have text but no behaviour: chips `Disematkan` (pinned snapshot) / `Tidak disajikan`, and paper card `Isu import (n)` + `Lihat`.
- m6 `Pilih N` over groups: the choice unit is the numbered question; a group is never split across choices (state in Q-14).
- m7 Review semantics: `Tolak` on a stimulus item discards the group, keeps member items `pending` with `stimulus_missing`; `Tolak` on a member removes it from the range; Terima of a member before its group exists creates the group from the extracted stimulus first.
- m8 Fix typo "13 modes" (14 listed); use "Rangsangan ini masih digunakan oleh {n} soalan." (DM-02) and retire code text `inUse`.

## 4. Verdict

Matches V2 and improves it where V2 is wrong? **NO (not yet).**
The PRD reproduces almost every V2 function (about 41 of 55 rows Same/Improved, deliberate drops justified) and correctly fixes the DSKP order and group-first entry for manual entry and paper assembly. But three paths still allow the split the user complained about or make the stated ACs impossible: partial groups can be published and served (B1); a published group cannot be edited under the code's served lock and the PRD gives no draft path (B2); regroup of served/unflagged legacy questions is blocked or collides with the DSKP gate (B3). Detection also ignores unnumbered references (M1), and five V2 functions are missing (stem field, word limit, PKSK Soalan, `Sembunyikan`, Diagram audit menu). With B1-B3 and M1-M8 merged the answer becomes YES.

Counts: Same 29, Improved 12, Missing 5, Dropped 6 (inventory of 55 rows).

Top 10 gaps:
1. B1 Partial group can be served; add group-level publish `Terbitkan kumpulan` and group servability.
2. B2 No path to edit a published group (served lock vs AC-QE1.2/Q05.1); add `Sunting kumpulan` draft copy.
3. B3 Regroup of served/unflagged legacy questions blocked and gate-sensitive; make it an in-place audited structural change.
4. M1 Reference detection is numbered only ("Rajah 3"); "Rajah di atas", "Maklumat di bawah", "Sumber/Teks" and two-figure items unspecified.
5. M3 Publish gate does not block `stimulus_missing` / `figure_only`; V2 stem placeholder invites the defect.
6. M2 Group screen lacks `Label`, `Teks alternatif`, `Sumber`, `Bank pilihan`, 2nd/3rd stimulus, preview.
7. M4 CSV group columns incomplete (kind, label, caption, image source, order, contiguity, existing group).
8. M5 Diagram audit ("gambar tiada") has no Admin Pusat menu entry or spec.
9. M6 V2 `Teks soalan (stem)` and `Had perkataan` absent from PRD and contract.
10. M7/M8 Undocumented drop of 8 stimulus kinds (code/pseudocode, audio) and no spec for Soalan PKSK.
